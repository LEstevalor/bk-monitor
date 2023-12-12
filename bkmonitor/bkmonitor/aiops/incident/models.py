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
from dataclasses import asdict, dataclass
from typing import Dict, List

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


@dataclass
class IncidentGraphEntity:
    """
    "entity_id": "BCS-K8S-xxxx#k8s-idc-br#uid-0",
    "entity_type": "BcsPod",
    "is_anomaly": false,
    "anomaly_score": 0.3333333333333333,
    "anomaly_type": "死机/重启",
    "is_root": false,
    "product_hierarchy_rank": "rank_0"
    """

    entity_id: str
    entity_type: str
    is_anomaly: bool
    anomaly_score: float
    anomaly_type: str
    is_root: bool
    rank: IncidentGraphRank


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


@dataclass
class IncidentSnapshot(object):
    """
    用于处理故障根因定位结果快照数据的类.
    """

    incident_snapshot_content: Dict

    def __post_init__(self):
        self.incident_graph_categories = {}
        self.incident_graph_ranks = {}
        self.incident_graph_entities = {}
        self.incident_graph_edges = []
        self.alert_entity_mapping = {}

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
            self.incident_graph_edges.append(
                IncidentGraphEdge(
                    source=self.incident_graph_entities[edge_info["source_id"]],
                    target=self.incident_graph_entities[edge_info["target_id"]],
                )
            )

    def prepare_alerts(self):
        """根据故障分析结果快照构建告警所在实体的关系."""
        for alert_info in self.incident_snapshot_content["incident_alerts"]:
            entity_id = alert_info.pop("entity_id")
            alert_info["entity"] = self.incident_graph_entities[entity_id] if entity_id else None
            incident_alert = IncidentAlert(**alert_info)
            self.alert_entity_mapping[incident_alert.id] = incident_alert

    def get_related_alert_ids(self) -> List[Dict]:
        """检索故障根因定位快照关联的告警详情列表.

        :return: 告警详情列表
        """
        return [int(item["id"]) for item in self.incident_snapshot_content["incident_alerts"]]

    def upstreams_group_by_rank(self, entity_id: str) -> List[Dict]:
        """根据实体ID找到所有上下游全链路，并按照rank维度分层

        :param entity_id: 实体ID
        :return: 按rank分层的上下游
        """
        if entity_id not in self.incident_graph_entities:
            raise IncidentEntityNotFoundError({"entity_id": entity_id})
        entity = self.incident_graph_entities[entity_id]

        ranks = {
            rank.rank_id: {
                **asdict(rank),
                "entities": {},
            }
            for rank in self.incident_graph_ranks.values()
        }

        self.move_upstreams_into_ranks(entity, "source", ranks)
        self.move_upstreams_into_ranks(entity, "target", ranks)

        for rank in ranks.values():
            rank["entities"] = list(rank["entities"].values())

        return list(ranks.values())

    def move_upstreams_into_ranks(self, entity: IncidentGraphEntity, direct_key: str, ranks: Dict) -> None:
        """把节点关联的上游或下游加入到ranks层级中

        :param entity: 故障实体
        :param direct_key: 上游或下游的方向key
        :param ranks: 层级
        """
        for edge in self.incident_graph_edges:
            if direct_key == "source" and edge.target.entity_id == entity.entity_id:
                self.move_upstreams_into_ranks(edge.source, direct_key, ranks)

            if direct_key == "target" and edge.source.entity_id == entity.entity_id:
                self.move_upstreams_into_ranks(edge.target, direct_key, ranks)

        if entity.entity_id not in ranks[entity.rank.rank_id]["entities"]:
            ranks[entity.rank.rank_id]["entities"][entity.entity_id] = entity
