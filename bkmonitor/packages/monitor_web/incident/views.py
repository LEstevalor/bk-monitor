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
from rest_framework import permissions

from bkmonitor.iam import ActionEnum
from bkmonitor.iam.drf import BusinessActionPermission
from core.drf_resource import resource
from core.drf_resource.viewsets import ResourceRoute, ResourceViewSet


class IncidentViewSet(ResourceViewSet):
    query_post_actions = []

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS or self.action in self.query_post_actions:
            return [BusinessActionPermission([ActionEnum.VIEW_INCIDENT])]
        return [BusinessActionPermission([ActionEnum.MANAGE_INCIDENT])]

    resource_routes = [
        # 故障列表接口
        ResourceRoute("GET", resource.incident.incident_list, endpoint="incident_list"),
        # 故障汇总统计接口
        ResourceRoute("GET", resource.incident.incident_overview, endpoint="incident_overview"),
        # 故障详情接口
        ResourceRoute("GET", resource.incident.incident_detail, endpoint="incident_detail"),
        # 故障拓扑图接口
        ResourceRoute("GET", resource.incident.incident_topology, endpoint="incident_topology"),
        # 故障时序图接口
        ResourceRoute("GET", resource.incident.incident_time_line, endpoint="incident_time_line"),
        # 故障告警对象接口
        ResourceRoute("GET", resource.incident.incident_targets, endpoint="incident_targets"),
        # 故障告警处理人接口
        ResourceRoute("GET", resource.incident.incident_handlers, endpoint="incident_handlers"),
        # 故障流转列表接口
        ResourceRoute("GET", resource.incident.incident_operations, endpoint="incident_operations"),
        # 编辑故障
        ResourceRoute("POST", resource.incident.edit_incident, endpoint="edit_incident"),
        # 反馈故障根因
        ResourceRoute("POST", resource.incident.feedback_incident_root, endpoint="feedback_incident_root"),
    ]
