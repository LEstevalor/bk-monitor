# -*- coding: utf-8 -*-
"""
Tencent is pleased to support the open source community by making 蓝鲸智云 - 监控平台 (BlueKing - Monitor) available.
Copyright (C) 2017-2021 THL A29 Limited, a Tencent company. All rights reserved.
Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
You may obtain a copy of the License at http://opensource.org/licenses/MIT
Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on
an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
"""
import copy
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from typing import Dict, List

from constants.incident import IncidentGraphEdgeType
from core.errors.incident import IncidentEntityNotFoundError


@dataclass
class IncidentGraphCategory:
    """
    "category_id": 2,
    "category_name": "data_center",
    "category_alias": "数据中心"
    """

    category_id: int
    category_name: str
    category_alias: str

    def to_src_dict(self):
        return asdict(self)


@dataclass
class IncidentGraphRank:
    """
    "rank_id": 0,
    "rank_name": "service_module",
    "rank_alias": "服务模块",
    "rank_category": "service"
    """

    rank_id: int
    rank_name: str
    rank_alias: str
    rank_category: IncidentGraphCategory

    def to_src_dict(self):
        data = asdict(self)
        data["rank_category"] = data.pop("rank_category")["category_name"]
        return data


@dataclass
class IncidentGraphEntity:
    """
    "entity_id": "BCS-K8S-xxxx#k8s-idc-br#uid-0",
    "entity_name": "BCS-K8S-xxxx#k8s-idc-br#uid-0",
    "entity_type": "BcsPod",
    "is_anomaly": false,
    "anomaly_score": 0.3333333333333333,
    "anomaly_type": "死机/重启",
    "is_root": false,
    "product_hierarchy_rank": "rank_0"
    """

    entity_id: str
    entity_name: str
    entity_type: str
    is_anomaly: bool
    anomaly_score: float
    anomaly_type: str
    is_root: bool
    rank: IncidentGraphRank
    aggregated_entities: List["IncidentGraphEntity"] = field(default_factory=list)

    def to_src_dict(self):
        data = asdict(self)
        data["rank_name"] = data.pop("rank")["rank_name"]
        return data


@dataclass
class IncidentGraphEdge:
    """
    "source_type": "BkNodeHost",
    "target_type": "BcsPod",
    "source_id": "0#xx.xx.xx.xx",
    "target_id": "BCS-K8S-xxxxx#k8s-idc-br#uid-0"
    """

    source: IncidentGraphEntity
    target: IncidentGraphEntity
    edge_type: IncidentGraphEdgeType
    count: int = 1

    def to_src_dict(self):
        return {
            "source_type": self.source.entity_type,
            "source_id": self.source.entity_id,
            "target_type": self.target.entity_type,
            "target_id": self.target.entity_id,
            "edge_type": self.edge_type.value,
        }


@dataclass
class IncidentAlert:
    """
    "id": "170191709725733",
    "strategy_id": "25",
    "entity_id": "BCS-K8S-xxxx#k8s-idc-br#uid-0"
    """

    id: int
    strategy_id: int
    entity: IncidentGraphEntity

    def to_src_dict(self):
        data = asdict(self)
        data["entity_id"] = data.pop("entity")["entity_id"]
        return data


@dataclass
class IncidentSnapshot(object):
    """
    用于处理故障根因定位结果快照数据的类.
    """

    incident_snapshot_content: Dict

    def __post_init__(self, prepare=True):
        self.incident_graph_categories = {}
        self.incident_graph_ranks = {}
        self.incident_graph_entities = {}
        self.incident_graph_edges = {}
        self.alert_entity_mapping = {}
        self.bk_biz_id = None
        self.entity_targets = defaultdict(set)
        self.entity_sources = defaultdict(set)

        if prepare:
            self.prepare_graph()
            self.prepare_alerts()

    def prepare_graph(self):
        """根据故障分析结果快照实例化图结构."""
        for category_name, category_info in self.incident_snapshot_content["product_hierarchy_category"].items():
            self.incident_graph_categories[category_name] = IncidentGraphCategory(**category_info)

        for rank_name, rank_info in self.incident_snapshot_content["product_hierarchy_rank"].items():
            rank_info["rank_category"] = self.incident_graph_categories[rank_info["rank_category"]]
            self.incident_graph_ranks[rank_name] = IncidentGraphRank(**rank_info)

        for entity_info in self.incident_snapshot_content["incident_propagation_graph"]["entities"]:
            entity_info["rank"] = self.incident_graph_ranks[entity_info.pop("rank_name")]
            self.incident_graph_entities[entity_info["entity_id"]] = IncidentGraphEntity(**entity_info)

        for edge_info in self.incident_snapshot_content["incident_propagation_graph"]["edges"]:
            source = self.incident_graph_entities[edge_info["source_id"]]
            target = self.incident_graph_entities[edge_info["target_id"]]
            self.entity_sources[target.entity_id].add(source.entity_id)
            self.entity_targets[source.entity_id].add(target.entity_id)
            self.incident_graph_edges[(source.entity_id, target.entity_id)] = IncidentGraphEdge(
                source=source, target=target, edge_type=IncidentGraphEdgeType(edge_info["edge_type"])
            )

        self.bk_biz_id = self.incident_snapshot_content["bk_biz_id"]

    def prepare_alerts(self):
        """根据故障分析结果快照构建告警所在实体的关系."""
        for alert_info in self.incident_snapshot_content["incident_alerts"]:
            incident_alert_info = copy.deepcopy(alert_info)
            entity_id = incident_alert_info.pop("entity_id")
            incident_alert_info["entity"] = self.incident_graph_entities[entity_id] if entity_id else None
            incident_alert = IncidentAlert(**incident_alert_info)
            self.alert_entity_mapping[incident_alert.id] = incident_alert

    def get_related_alert_ids(self) -> List[int]:
        """检索故障根因定位快照关联的告警详情列表.

        :return: 告警详情列表
        """
        return [int(item["id"]) for item in self.incident_snapshot_content["incident_alerts"]]

    def entity_alerts(self, entity_id) -> List[int]:
        """实体告警列表

        :param entity_id: 实体ID
        :return: 实体告警ID列表
        """
        return [
            int(item["id"])
            for item in self.incident_snapshot_content["incident_alerts"]
            if item["entity_id"] == entity_id
        ]

    def generate_entity_sub_graph(self, entity_id: str) -> "IncidentSnapshot":
        """生成资源子图

        :param entity_id: 实体ID
        :return: 资源上下游关系的资源子图
        """
        if entity_id not in self.incident_graph_entities:
            raise IncidentEntityNotFoundError({"entity_id": entity_id})
        entity = self.incident_graph_entities[entity_id]

        sub_incident_snapshot_content = copy.deepcopy(self.incident_snapshot_content)
        sub_incident_snapshot_content["incident_alerts"] = []
        sub_incident_snapshot_content["product_hierarchy_category"] = {}
        sub_incident_snapshot_content["product_hierarchy_rank"] = {}
        sub_incident_snapshot_content["incident_propagation_graph"] = {"entities": [], "edges": []}

        self.move_upstream_to_sub_graph_content(entity, "source", sub_incident_snapshot_content)
        self.move_upstream_to_sub_graph_content(entity, "target", sub_incident_snapshot_content)

        sub_incident_snapshot_content["alerts"] = len(sub_incident_snapshot_content["incident_alerts"])

        return IncidentSnapshot(sub_incident_snapshot_content)

    def move_upstream_to_sub_graph_content(
        self, entity: IncidentGraphEntity, direct_key: str, graph_content: Dict
    ) -> None:
        """把节点关联的上游或下游加入到子图内容内容中

        :param entity: 故障实体
        :param direct_key: 上游或下游的方向key
        :param graph_content: 图内容
        """
        for edge in self.incident_graph_edges.values():
            if direct_key == "source" and edge.target.entity_id == entity.entity_id:
                graph_content["incident_propagation_graph"]["edges"].append(edge.to_src_dict())
                self.move_upstream_to_sub_graph_content(edge.source, direct_key, graph_content)

            if direct_key == "target" and edge.source.entity_id == entity.entity_id:
                graph_content["incident_propagation_graph"]["edges"].append(edge.to_src_dict())
                self.move_upstream_to_sub_graph_content(edge.target, direct_key, graph_content)

        graph_content["incident_propagation_graph"]["entities"].append(entity.to_src_dict())
        if entity.rank.rank_name not in graph_content["product_hierarchy_rank"]:
            graph_content["product_hierarchy_rank"][entity.rank.rank_name] = entity.rank.to_src_dict()
        if entity.rank.rank_category.category_name not in graph_content["product_hierarchy_category"]:
            graph_content["product_hierarchy_category"][
                entity.rank.rank_category.category_name
            ] = entity.rank.rank_category.to_src_dict()

        for incident_alert in self.alert_entity_mapping.values():
            if incident_alert.entity.entity_id == entity.entity_id:
                graph_content["incident_alerts"].append(incident_alert.to_src_dict())

    def group_by_rank(self) -> List[Dict]:
        """根据实体ID找到所有上下游全链路，并按照rank维度分层

        :return: 按rank分层的上下游
        """
        ranks = {
            rank.rank_id: {
                **asdict(rank),
                "sub_ranks": {},
                "total": 0,
                "anomaly_count": 0,
            }
            for rank in self.incident_graph_ranks.values()
        }
        entity_type_depths = {}
        for entity in self.incident_graph_entities.values():
            if len(self.entity_sources[entity.entity_id]) == 0:
                entity_type_depths[entity.entity_type] = 0
                self.find_entity_type_depths(entity.entity_type, 0, entity_type_depths)

        for entity in self.incident_graph_entities.values():
            sub_rank_key = (entity.rank.rank_id, -entity_type_depths[entity.entity_type])
            if sub_rank_key not in ranks[entity.rank.rank_id]["sub_ranks"]:
                ranks[entity.rank.rank_id]["sub_ranks"][sub_rank_key] = []
            ranks[entity.rank.rank_id]["sub_ranks"][sub_rank_key].append(entity)

            if entity.is_anomaly:
                ranks[entity.rank.rank_id]["anomaly_count"] += 1
            ranks[entity.rank.rank_id]["total"] += 1

            for aggregated_entity in entity.aggregated_entities:
                if aggregated_entity.is_anomaly:
                    ranks[entity.rank.rank_id]["anomaly_count"] += 1
                ranks[entity.rank.rank_id]["total"] += 1

        final_ranks = []
        for rank_info in ranks.values():
            sorted_sub_rank_keys = sorted(rank_info["sub_ranks"].keys())
            for index, sub_rank_key in enumerate(sorted_sub_rank_keys):
                new_rank = {key: value for key, value in rank_info.items() if key != "sub_ranks"}
                new_rank["entities"] = rank_info["sub_ranks"][sub_rank_key]
                new_rank["is_sub_rank"] = True if index > 0 else False
                final_ranks.append(new_rank)

        return final_ranks

    def find_entity_type_depths(self, entity_type: str, current_depth: int, entity_type_depths: Dict) -> None:
        """递归设置每种实体在拓扑图中的深度.

        :param entity_type: 实体类型
        :param current_depth: 当前深度
        :param entity_type_depths: 实体类型深度字典
        """
        next_entity_types = set()
        for entity in self.incident_graph_entities.values():
            if entity_type == entity.entity_type:
                for target_entity_id in self.entity_targets[entity.entity_id]:
                    target = self.incident_graph_entities[target_entity_id]
                    next_entity_types.add(target.entity_type)
                    entity_type_depths[target.entity_type] = current_depth + 1

        for next_entity_type in list(next_entity_types):
            self.find_entity_type_depths(next_entity_type, current_depth + 1, entity_type_depths)

    def aggregate_graph(self, aggregate_config: Dict = None) -> None:
        """聚合图谱

        :param aggregate_config: 聚合配置，没有则按照是否有同质化边，且被聚合节点数大于等于3进行聚合
        """
        group_by_entities = {}

        for entity_id, entity in self.incident_graph_entities.items():
            key = (
                frozenset(self.entity_sources[entity_id]),
                frozenset(self.entity_targets[entity_id]),
                entity_id if entity.is_anomaly or entity.is_root else "normal",
            )
            if key not in group_by_entities:
                group_by_entities[key] = set()
            group_by_entities[key].add(entity.entity_id)

        for entity_ids in group_by_entities.values():
            if len(entity_ids) >= 3:
                self.merge_entities(list(entity_ids))

    def merge_entities(self, entity_ids: List[str]) -> None:
        """合并同类实体

        :param entity_ids: 待合并实体列表
        """
        main_entity = self.incident_graph_entities[entity_ids[0]]
        main_entity.aggregated_entities = [self.incident_graph_entities[entity_id] for entity_id in entity_ids[1:]]
        for entity in main_entity.aggregated_entities:
            for target_entity_id in self.entity_targets[entity.entity_id]:
                self.entity_sources[target_entity_id].remove(entity.entity_id)
                self.entity_sources[target_entity_id].add(main_entity.entity_id)
                self.incident_graph_edges[(main_entity.entity_id, target_entity_id)].count += 1
                del self.incident_graph_edges[(entity.entity_id, target_entity_id)]
            for source_entity_id in self.entity_sources[entity.entity_id]:
                self.entity_targets[source_entity_id].remove(entity.entity_id)
                self.entity_targets[source_entity_id].add(main_entity.entity_id)
                self.incident_graph_edges[(source_entity_id, main_entity.entity_id)].count += 1
                del self.incident_graph_edges[(source_entity_id, entity.entity_id)]

            del self.entity_targets[entity.entity_id]
            del self.entity_sources[entity.entity_id]
            del self.incident_graph_entities[entity.entity_id]
