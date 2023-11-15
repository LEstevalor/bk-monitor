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
from enum import Enum

from django.utils.translation import ugettext_lazy as _lazy


class CustomEnum(Enum):
    @classmethod
    def get_enum_value_list(cls, excludes=None):
        if excludes is None:
            excludes = []
        return [m.value for m in cls.__members__.values() if m.value not in excludes]


class IncidentStatus(CustomEnum):
    """故障状态枚举"""

    ABNORMAL = "abnormal"
    RECOVERED = "recovered"
    RECOVERING = "recovering"
    CLOSED = "closed"

    @property
    def alias(self) -> str:
        incident_status_map = {
            "abnormal": _lazy("未恢复"),
            "recovered": _lazy("已恢复"),
            "recovering": _lazy("观察中"),
            "closed": _lazy("已解决"),
        }
        return incident_status_map[self.value]


class IncidentLevel(CustomEnum):
    """故障级别枚举"""

    ERROR = "ERROR"
    WARN = "WARN"
    INFO = "INFO"

    @property
    def alias(self) -> str:
        incident_level_map = {
            "ERROR": _lazy("致命"),
            "WARN": _lazy("告警"),
            "INFO": _lazy("提醒"),
        }
        return incident_level_map[self.value]


class IncidentOperationClass(CustomEnum):
    """故障操作类别"""

    SYSTEM = "system"
    USER = "user"

    @property
    def alias(self) -> str:
        incident_operation_class_map = {
            "system": _lazy("系统事件"),
            "user": _lazy("人工操作"),
        }
        return incident_operation_class_map[self.value]


class IncidentOperationType(CustomEnum):
    """故障操作类型"""

    CREATE = ("incident_create", IncidentOperationClass.SYSTEM)
    OBSERVE = ("incident_observe", IncidentOperationClass.SYSTEM)
    RECOVERE = ("incident_recover", IncidentOperationClass.SYSTEM)
    NOTICE = ("incident_notice", IncidentOperationClass.SYSTEM)
    UPDATE = ("incident_update", IncidentOperationClass.SYSTEM)
    ALERT_TRIGGER = ("alert_trigger", IncidentOperationClass.SYSTEM)
    ALERT_RECOVER = ("alert_recover", IncidentOperationClass.SYSTEM)
    ALERT_INVALID = ("alert_invalid", IncidentOperationClass.SYSTEM)
    ALERT_NOTICE = ("alert_notice", IncidentOperationClass.SYSTEM)
    ALERT_CONVERGENCE = ("alert_convergence", IncidentOperationClass.SYSTEM)
    MANUAL_UPDATE = ("manual_update", IncidentOperationClass.UESR)
    FEEDBACK = ("feedback", IncidentOperationClass.UESR)
    CLOSE = ("incident_close", IncidentOperationClass.UESR)
    GROUP_GATHER = ("group_gather", IncidentOperationClass.UESR)
    ALERT_COMFIRM = ("alert_confirm", IncidentOperationClass.UESR)
    ALERT_SHIELD = ("alert_shield", IncidentOperationClass.UESR)
    ALERT_HANDLE = ("alert_handle", IncidentOperationClass.UESR)
    ALERT_CLOSE = ("alert_close", IncidentOperationClass.UESR)
    ALERT_DISPATCH = ("alert_dispatch", IncidentOperationClass.UESR)

    def __init__(self, value: str, operation_class: IncidentOperationClass) -> None:
        self.value = value
        self.operation_class = operation_class

    @property
    def alias(self):
        incident_operation_type_map = {
            "incident_create": _lazy("故障生成"),
            "incident_observe": _lazy("故障观察中"),
            "incident_recover": _lazy("故障恢复"),
            "incident_notice": _lazy("故障通知"),
            "incident_update": _lazy("修改故障属性"),
            "alert_trigger": _lazy("触发告警"),
            "alert_recover": _lazy("告警恢复"),
            "alert_invalid": _lazy("告警失效"),
            "alert_notice": _lazy("告警通知"),
            "alert_convergence": _lazy("告警收敛"),
            "manual_update": _lazy("修改故障属性"),
            "feedback": _lazy("反馈/取消反馈根因"),
            "incident_close": _lazy("故障关闭"),
            "group_gather": _lazy("一键拉群"),
            "alert_confirm": _lazy("告警确认"),
            "alert_shield": _lazy("告警屏蔽"),
            "alert_handle": _lazy("告警处理"),
            "alert_close": _lazy("告警关闭"),
            "alert_dispatch": _lazy("告警分派"),
        }
        return incident_operation_type_map[self.value]
