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
from typing import Dict

from bkmonitor.documents.incident import IncidentDocument
from bkmonitor.utils.time_tools import hms_string
from bkmonitor.views import serializers
from constants.incident import IncidentStatus
from core.drf_resource import api
from core.drf_resource.base import Resource
from fta_web.alert.handlers.incident import IncidentQueryHandler
from fta_web.models.alert import SearchHistory, SearchType


class IncidentListResource(Resource):
    """
    故障列表
    """

    def __init__(self):
        super(IncidentListResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        status = serializers.ChoiceField(
            required=False,
            default=None,
            label="故障状态",
            choices=IncidentStatus.get_enum_value_list(),
        )
        level = serializers.ListField(required=False, label="故障级别", default=[])
        assignee = serializers.ListField(required=False, label="故障负责人", default=[])
        handler = serializers.ListField(required=False, label="故障处理人", default=[])
        query_string = serializers.CharField(required=False, label="故障筛选内容", default='')
        time_range = serializers.CharField(required=False, label="时间范围", allow_blank=True, allow_null=True)
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

        result["incidents"] = [
            {
                "incident_id": 1,
                "incident_name": "我是故障名占位",
                "incident_reason": "我是故障原因占位",
                "bk_biz_id": 10,
                "create_time": 1700000000,
                "update_time": 1700000000,
                "begin_time": 1700000000,
                "end_time": None,
                "alert_count": 48,
                "assignee": ["admin", "admin2"],
                "handlers": ["admin3", "admin4"],
                "labels": ["游戏", "异常", "时序"],
                "status": "abnormal",
                "level": "ERROR",
                "dimensions": {"bk_cloud_id": 0},
                "incident_duration": hms_string(3000),
            },
            {
                "incident_id": 2,
                "incident_name": "我是故障名占位",
                "incident_reason": "我是故障原因占位",
                "bk_biz_id": 10,
                "create_time": 1700000000,
                "update_time": 1700000000,
                "begin_time": 1700000000,
                "end_time": None,
                "alert_count": 48,
                "assignee": ["admin", "admin2"],
                "handlers": ["admin3", "admin4"],
                "labels": ["游戏", "异常", "时序"],
                "status": "recovering",
                "level": "WARN",
                "dimensions": {"bk_cloud_id": 0},
                "incident_duration": hms_string(3000),
            },
            {
                "incident_id": 3,
                "incident_name": "我是故障名占位",
                "incident_reason": "我是故障原因占位",
                "bk_biz_id": 10,
                "create_time": 1700000000,
                "update_time": 1700000000,
                "begin_time": 1700000000,
                "end_time": None,
                "alert_count": 48,
                "assignee": ["admin", "admin2"],
                "handlers": ["admin3", "admin4"],
                "labels": ["游戏", "异常", "时序"],
                "status": "recovered",
                "level": "INFO",
                "dimensions": {"bk_cloud_id": 0},
                "incident_duration": hms_string(3000),
            },
            {
                "incident_id": 4,
                "incident_name": "我是故障名占位",
                "incident_reason": "我是故障原因占位",
                "bk_biz_id": 10,
                "create_time": 1700000000,
                "update_time": 1700000000,
                "begin_time": 1700000000,
                "end_time": 1700031890,
                "alert_count": 48,
                "assignee": ["admin", "admin2"],
                "handlers": ["admin3", "admin4"],
                "labels": ["游戏", "异常", "时序"],
                "status": "closed",
                "level": "WARN",
                "dimensions": {"bk_cloud_id": 0},
                "incident_duration": hms_string(3000),
            },
        ]

        return result


class IncidentOverviewResource(Resource):
    """
    故障汇总统计
    """

    def __init__(self):
        super(IncidentOverviewResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")
        status = serializers.ChoiceField(
            required=False,
            default=None,
            label="故障状态",
            choices=IncidentStatus.get_enum_value_list(),
        )
        time_range = serializers.CharField(required=False, label="时间范围", allow_blank=True, allow_null=True)

    def perform_request(self, validated_request_data: Dict) -> Dict:
        handler = IncidentQueryHandler(**validated_request_data)
        return handler.search(show_overview=True, show_aggs=False)


class IncidentDetailResource(Resource):
    """
    故障详情
    """

    def __init__(self):
        super(IncidentDetailResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        incident_id = validated_request_data["incident_id"]

        incident = IncidentDocument.get(incident_id)
        # incident["snapshots"] = self.get_incident_snapshots(incident)

        return {
            "incident_id": 1,
            "incident_name": "我是故障名占位",
            "incident_reason": "我是故障原因占位",
            "bk_biz_id": 10,
            "create_time": 1700000000,
            "update_time": 1700000000,
            "begin_time": 1700000000,
            "end_time": None,
            "alert_count": 48,
            "assignee": ["admin", "admin2"],
            "handlers": ["admin3", "admin4"],
            "labels": ["游戏", "异常", "时序"],
            "status": "abnormal",
            "level": "ERROR",
            "dimensions": {"bk_cloud_id": 0},
            "incident_duration": hms_string(3000),
            "current_incident_snapshot_id": 1000000,
        }

        return incident


class IncidentTopologyResource(Resource):
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


class IncidentTimeLineResource(Resource):
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


class IncidentTargetsResource(Resource):
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


class IncidentHandlersResource(Resource):
    """
    故障处理人列表
    """

    def __init__(self):
        super(IncidentHandlersResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class IncidentOperationsResource(Resource):
    """
    故障流转列表
    """

    def __init__(self):
        super(IncidentOperationsResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, validated_request_data: Dict) -> Dict:
        return {}


class EditIncidentResource(Resource):
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
        return {}


class FeedbackIncidentRootResource(Resource):
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
