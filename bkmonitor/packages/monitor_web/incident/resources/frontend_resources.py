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
from collections import Counter
from typing import Dict, List

from bkmonitor.documents.incident import (
    IncidentDocument,
    IncidentOperationDocument,
    IncidentSnapshotDocument,
)
from bkmonitor.utils.request import get_request_username
from bkmonitor.views import serializers
from constants.incident import IncidentOperationClass, IncidentOperationType
from core.drf_resource import api, resource
from core.drf_resource.base import Resource
from fta_web.alert.handlers.alert import AlertQueryHandler
from fta_web.alert.handlers.incident import IncidentQueryHandler
from fta_web.alert.resources import BaseTopNResource
from fta_web.models.alert import SearchHistory, SearchType
from monitor_web.incident.serializers import IncidentSearchSerializer


class IncidentBaseResource(Resource):
    """
    故障相关资源基类
    """

    def get_incident_alerts(self, incident_id: int) -> List[Dict]:
        ids = [170133033522966, 170130957522861, 170128740522571, 170124544222458]
        alerts = AlertQueryHandler(conditions=[{'key': 'id', 'value': ids, 'method': 'eq'}]).search()["alerts"]
        return alerts


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
        id = serializers.IntegerField(required=False, label="故障ID")
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
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class IncidentTimeLineResource(IncidentBaseResource):
    """
    故障时序图
    """

    def __init__(self):
        super(IncidentTimeLineResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class IncidentTargetsResource(IncidentBaseResource):
    """
    故障告警对象列表
    """

    def __init__(self):
        super(IncidentTargetsResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class IncidentHandlersResource(IncidentBaseResource):
    """
    故障处理人列表
    """

    def __init__(self):
        super(IncidentHandlersResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        alerts = self.get_incident_alerts(validated_request_data["id"])
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
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        operations = IncidentOperationDocument.list_by_incident_id(validated_request_data["incident_id"])
        return [operation.to_dict() for operation in operations]


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
        incident_id = serializers.IntegerField(required=False, label="故障ID")
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
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        contents = serializers.JSONField(required=True, label="反馈的内容")

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
        id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        alerts = self.get_incident_alerts(validated_request_data["id"])

        incident_alerts = resource.commons.get_label()
        for category in incident_alerts:
            category["alerts"] = []
            category["sub_categories"] = [item["id"] for item in category["children"]]

        for alert in alerts:
            alert["is_incident_root"] = False
            for category in incident_alerts:
                if alert["category"] in category["sub_categories"]:
                    category["alerts"].append(alert)
        alerts[0]["is_incident_root"] = True

        return incident_alerts
