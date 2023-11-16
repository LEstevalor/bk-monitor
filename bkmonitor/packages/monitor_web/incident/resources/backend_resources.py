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
from bkmonitor.views import serializers
from constants.incident import IncidentStatus
from core.drf_resource.base import Resource


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
        page = serializers.IntegerField(required=False, label="页码")
        page_size = serializers.IntegerField(required=False, label="每页条数")

    def perform_request(self, data):
        # bk_biz_id = data.get("bk_biz_id")
        # status = data.get("status")
        # level = data.get("level")
        # assignee = data.get("assignee")
        # handler = data.get("handler")
        # query_string = data.get("query_string")
        # time_range = data.get("time_range")
        # page = data.get("page", 0)
        # page_size = data.get("page_size", 0)

        incident_list = [
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
            },
        ]

        return {"total": 4, "incidents": incident_list}


class IncidentDetailResource(Resource):
    """
    故障详情
    """

    def __init__(self):
        super(IncidentDetailResource, self).__init__()

    class RequestSerializer(serializers.Serializer):
        incident_id = serializers.IntegerField(required=False, label="故障ID")
        bk_biz_id = serializers.IntegerField(required=True, label="业务ID")

    def perform_request(self, data):
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
            "incident_duration": 3000,
            "current_incident_snapshot_id": 1000000,
        }
