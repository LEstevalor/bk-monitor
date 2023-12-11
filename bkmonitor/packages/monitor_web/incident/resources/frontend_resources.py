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
import time
from collections import Counter
from dataclasses import asdict
from typing import Any, Dict, List

from bkmonitor.aiops.incident.models import IncidentGraphEntity, IncidentSnapshot
from bkmonitor.aiops.incident.operation import IncidentOperationManager
from bkmonitor.documents.incident import (
    IncidentDocument,
    IncidentOperationDocument,
    IncidentSnapshotDocument,
)
from bkmonitor.utils.request import get_request_username
from bkmonitor.views import serializers
from constants.incident import (
    IncidentAlertAggregateDimension,
    IncidentOperationClass,
    IncidentOperationType,
)
from core.drf_resource import api, resource
from core.drf_resource.base import Resource
from fta_web.alert.handlers.alert import AlertQueryHandler
from fta_web.alert.handlers.incident import IncidentQueryHandler
from fta_web.alert.resources import BaseTopNResource
from fta_web.alert.serializers import AlertSearchSerializer
from fta_web.models.alert import SearchHistory, SearchType
from monitor_web.incident.serializers import IncidentSearchSerializer


class IncidentBaseResource(Resource):
    """
    故障相关资源基类
    """

    def get_snapshot_alerts(self, snapshot: IncidentSnapshot, **kwargs) -> List[Dict]:
        alert_ids = snapshot.get_related_alert_ids()
        if "conditions" in kwargs:
            kwargs["conditions"].append({'key': 'id', 'value': alert_ids, 'method': 'eq'})
        else:
            kwargs["conditions"] = [{'key': 'id', 'value': alert_ids, 'method': 'eq'}]
        alerts = AlertQueryHandler(**kwargs).search()["alerts"]
        return alerts

    def get_item_by_chain_key(self, data: Dict, chain_key: str) -> Any:
        keys = chain_key.split(".")
        for key in keys:
            if not data or not isinstance(data, dict):
                return None

            data = data.get(key)
        return data


class IncidentListResource(IncidentBaseResource):
    """
    故障列表
    """

    def __init__(self):
        super(IncidentListResource, self).__init__()

    class RequestSerializer(IncidentSearchSerializer):
        level = serializers.ListField(required=False, label="故障级别", default=[])
        assignee = serializers.ListField(required=False, label="故障负责人", default=[])
        handler = serializers.ListField(required=False, label="故障处理人", default=[])
        record_history = serializers.BooleanField(label="是否保存收藏历史", default=False)
        page = serializers.IntegerField(required=False, label="页码")
        page_size = serializers.IntegerField(required=False, label="每页条数")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        record_history = validated_request_data.pop("record_history")

        handler = IncidentQueryHandler(**validated_request_data)

        with SearchHistory.record(
            SearchType.INCIDENT,
            validated_request_data,
            enabled=record_history and validated_request_data.get("query_string"),
        ):
            result = handler.search(show_overview=False, show_aggs=True)

        return result


class IncidentOverviewResource(IncidentBaseResource):
    """
    故障汇总统计
    """

    def __init__(self):
        super(IncidentOverviewResource, self).__init__()

    RequestSerializer = IncidentSearchSerializer

    def perform_request(self, validated_request_data: Dict) -> Dict:
        handler = IncidentQueryHandler(**validated_request_data)
        return handler.search(show_overview=True, show_aggs=False)


class IncidentTopNResource(BaseTopNResource):
    handler_cls = IncidentQueryHandler

    class RequestSerializer(IncidentSearchSerializer, BaseTopNResource.RequestSerializer):
        pass


class IncidentValidateQueryStringResource(Resource):
    """
    校验 query_string 是否合法
    """

    class RequestSerializer(serializers.Serializer):
        query_string = serializers.CharField(label="查询字符串", allow_blank=True)

    def perform_request(self, validated_request_data):
        if not validated_request_data["query_string"]:
            return ""

        return IncidentQueryHandler.query_transformer.transform_query_string(
            query_string=validated_request_data["query_string"]
        )


class IncidentDetailResource(IncidentBaseResource):
    """
    故障详情
    """

    def __init__(self):
        super(IncidentDetailResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        id = validated_request_data["id"]

        incident = IncidentDocument.get(id).to_dict()
        incident = IncidentQueryHandler.handle_hit(incident)
        incident["snapshots"] = [item.to_dict() for item in self.get_incident_snapshots(incident)]
        incident["bk_biz_name"] = resource.cc.get_app_by_id(2).name
        if len(incident["snapshots"]) > 0:
            incident["current_snapshot"] = incident["snapshots"][-1]
            incident["alert_count"] = len(incident["current_snapshot"]["alerts"])

        return incident

    def get_incident_snapshots(self, incident: IncidentDocument) -> Dict:
        """根据故障详情获取故障快照

        :param incident: 故障详情
        :return: 故障快照信息
        """
        snapshots = IncidentSnapshotDocument.list_by_incident_id(incident["incident_id"])
        return snapshots


class IncidentTopologyResource(IncidentBaseResource):
    """
    故障拓扑图
    """

    def __init__(self):
        super(IncidentTopologyResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident = IncidentDocument.get(validated_request_data.pop("id"))
        snapshot = IncidentSnapshot(incident.snapshot.content.to_dict())

        topology_data = self.generate_topology_data_from_snapshot(snapshot)

        return topology_data

    def generate_topology_data_from_snapshot(self, snapshot: IncidentSnapshot) -> Dict:
        """根据快照内容生成拓扑图数据

        :param snapshot: 快照内容
        :return: 拓扑图数据
        """
        topology_data = {
            "nodes": [
                {
                    "id": entity.entity_id,
                    "comboId": entity.rank.rank_category.category_id,
                    "status": self.generate_topo_node_status(entity),
                    "aggregateNode": [],
                    "entity": asdict(entity),
                }
                for entity in snapshot.incident_graph_entities.values()
            ],
            "edges": [
                {"source": edge.source.entity_id, "target": edge.target.entity_id, "count": 1, "type": "include"}
                for edge in snapshot.incident_graph_edges
            ],
            "combos": [
                {
                    "id": category.category_id,
                    "label": category.category_alias,
                    "dataType": category.category_name,
                }
                for category in snapshot.incident_graph_categories.values()
            ],
        }
        return topology_data

    def generate_topo_node_status(self, entity: IncidentGraphEntity) -> str:
        """根据图谱实体的配置生成拓扑节点的状态

        :param entity: 图谱实体
        :return: 拓扑图节点状态
        """
        if entity.is_root:
            return "root"

        if entity.is_anomaly:
            return "error"

        return "normal"


class IncidentTimeLineResource(IncidentBaseResource):
    """
    故障时序图
    """

    def __init__(self):
        super(IncidentTimeLineResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class IncidentAlertAggregateResource(IncidentBaseResource):
    """
    故障告警按维度聚合接口
    """

    def __init__(self):
        super(IncidentAlertAggregateResource, self).__init__()

    class RequestSerializer(AlertSearchSerializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        aggregate_bys = serializers.MultipleChoiceField(
            required=True, choices=IncidentAlertAggregateDimension.get_enum_value_list(), label="聚合维度"
        )
        ordering = serializers.ListField(label="排序", child=serializers.CharField(), default=[])
        page = serializers.IntegerField(label="页数", min_value=1, default=1)
        page_size = serializers.IntegerField(label="每页大小", min_value=0, max_value=5000, default=300)
        record_history = serializers.BooleanField(label="是否保存收藏历史", default=False)
        must_exists_fields = serializers.ListField(label="必要字段", child=serializers.CharField(), default=[])

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident = IncidentDocument.get(validated_request_data.pop("id"))
        snapshot = IncidentSnapshot(incident.snapshot.content.to_dict())

        record_history = validated_request_data.pop("record_history")

        with SearchHistory.record(
            SearchType.ALERT,
            validated_request_data,
            enabled=record_history and validated_request_data.get("query_string"),
        ):
            alerts = self.get_snapshot_alerts(snapshot, **validated_request_data)

        aggregate_results = self.aggregate_alerts(alerts, validated_request_data["aggregate_bys"])

        return aggregate_results

    def aggregate_alerts(self, alerts: Dict, aggregate_bys: List[str]) -> Dict:
        """对故障的告警进行聚合.

        :param alerts: _description_
        :return: _description_
        """
        pass


class IncidentHandlersResource(IncidentBaseResource):
    """
    故障处理人列表
    """

    def __init__(self):
        super(IncidentHandlersResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident = IncidentDocument.get(validated_request_data["id"])
        snapshot = IncidentSnapshot(incident.snapshot.content.to_dict())
        alerts = self.get_snapshot_alerts(snapshot)
        current_username = get_request_username()

        alert_agg_results = Counter()
        for alert in alerts:
            if not alert["assignee"]:
                continue
            for username in alert["assignee"]:
                alert_agg_results[username] += 1

        handlers = {
            "all": {
                "id": "all",
                "name": "全部",
                "index": 1,
                "alert_count": len(alerts),
            },
            "not_dispatch": {
                "id": "not_dispatch",
                "name": "未分派",
                "index": 2,
                "alert_count": 0,
            },
            "mine": {
                "id": current_username,
                "name": "我负责",
                "index": 3,
                "alert_count": alert_agg_results.get(current_username, 0),
            },
            "other": {
                "id": "other",
                "name": "其他",
                "index": 4,
                "children": [
                    {
                        "id": username,
                        "name": username,
                        "alert_count": alert_count,
                    }
                    for username, alert_count in alert_agg_results.items()
                    if username != current_username
                ],
            },
        }

        return handlers


class IncidentOperationsResource(IncidentBaseResource):
    """
    故障流转列表
    """

    def __init__(self):
        super(IncidentOperationsResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=True, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        operations = IncidentOperationDocument.list_by_incident_id(validated_request_data["incident_id"])
        operations = [operation.to_dict() for operation in operations]
        for operation in operations:
            operation["operation_class"] = IncidentOperationType(operation["operation_type"]).operation_class.value
        return operations


class IncidentRecordOperationResource(IncidentBaseResource):
    """
    故障流转列表
    """

    def __init__(self):
        super(IncidentRecordOperationResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=True, label="故障ID")
        operation_type = serializers.ChoiceField(
            required=True, choices=IncidentOperationType.get_enum_value_list(), label="故障流转类型"
        )
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        extra_info = serializers.JSONField(required=True, label="额外信息")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        IncidentOperationManager.record_operation(
            incident_id=validated_request_data["incident_id"],
            operate_time=int(time.time()),
            **validated_request_data["extra_info"],
        )
        return "ok"


class IncidentOperationTypesResource(IncidentBaseResource):
    """
    故障流转列表
    """

    def __init__(self):
        super(IncidentOperationTypesResource, self).__init__()

    def perform_request(self, validated_request_data: Dict) -> Dict:
        operation_types = {
            operation_class: {
                "operation_class": operation_class.value,
                "operation_class_alias": operation_class.alias,
                "operation_types": [],
            }
            for operation_class in IncidentOperationClass.__members__.values()
        }

        for operation_type in IncidentOperationType.__members__.values():
            operation_types[operation_type.operation_class]["operation_types"].append(
                {
                    "operation_type": operation_type.value,
                    "operation_type_alias": operation_type.alias,
                }
            )
        return list(operation_types.values())


class EditIncidentResource(IncidentBaseResource):
    """
    故障修改接口
    """

    def __init__(self):
        super(EditIncidentResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        incident_id = serializers.IntegerField(required=True, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        incident_name = serializers.CharField(required=False, label="故障名称")
        incident_reason = serializers.CharField(required=False, label="故障原因")
        level = serializers.CharField(required=False, label="故障级别")
        assignee = serializers.ListField(required=False, label="故障负责人")
        handlers = serializers.ListField(required=False, label="故障处理人")
        labels = serializers.ListField(required=False, label="故障标签")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident_id = validated_request_data["incident_id"]

        incident_info = api.bkdata.get_incident_detail(incident_id=incident_id)
        incident_info.update(validated_request_data)
        api.bkdata.update_incident_detail(incident_id=incident_id, **incident_info)
        return incident_info


class FeedbackIncidentRootResource(IncidentBaseResource):
    """
    反馈故障根因
    """

    def __init__(self):
        super(FeedbackIncidentRootResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        incident_id = serializers.IntegerField(required=True, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        contents = serializers.JSONField(required=True, label="反馈的内容")
        is_cancel = serializers.BooleanField(required=False, default=False)

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident_id = validated_request_data["incident_id"]

        incident_info = api.bkdata.get_incident_detail(incident_id=incident_id)
        incident_info["feedback"].update(validated_request_data["contents"])
        api.bkdata.update_incident_detail(incident_id=incident_id, feedback=incident_info["feedback"])
        return incident_info["feedback"]


class IncidentAlertListResource(IncidentBaseResource):
    """
    故障告警列表
    """

    def __init__(self):
        super(IncidentAlertListResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=True, label="故障UUID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident = IncidentDocument.get(validated_request_data["id"])
        snapshot = IncidentSnapshot(incident.snapshot.content.to_dict())
        alerts = self.get_snapshot_alerts(snapshot)

        incident_alerts = resource.commons.get_label()
        for category in incident_alerts:
            category["alerts"] = []
            category["sub_categories"] = [item["id"] for item in category["children"]]

        for alert in alerts:
            alert_entity = snapshot.alert_entity_mapping.get(alert["id"])
            alert["entity"] = asdict(alert_entity.entity) if alert_entity else None
            for category in incident_alerts:
                if alert["category"] in category["sub_categories"]:
                    category["alerts"].append(alert)

        return incident_alerts
