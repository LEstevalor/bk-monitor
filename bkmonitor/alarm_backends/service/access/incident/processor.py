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
import json
from typing import Dict

from pika.adapters.blocking_connection import BlockingChannel
from pika.spec import Basic

from alarm_backends.core.storage.rabbitmq import RabbitMQClient
from alarm_backends.service.access.base import BaseAccessProcess
from bkmonitor.aiops.incident.operation import IncidentOperationManager
from bkmonitor.documents.base import BulkActionType
from bkmonitor.documents.incident import IncidentDocument, IncidentSnapshotDocument
from constants.incident import IncidentSyncType
from core.drf_resource import api


class BaseAccessIncidentProcess(BaseAccessProcess):
    pass


class AccessIncidentProcess(BaseAccessIncidentProcess):
    def __init__(self, broker_url: str, queue_name: str) -> None:
        super(AccessIncidentProcess, self).__init__()

        self.broker_url = broker_url
        self.queue_name = queue_name
        self.client = RabbitMQClient(broker_url=broker_url)

    def process(self) -> None:
        def callback(ch: BlockingChannel, method: Basic.Deliver, properties: Dict, body: str):
            sync_info = json.loads(body)
            self.handle_sync_info(sync_info)
            ch.basic_ack(method.delivery_tag)

        self.client.start_consuming(self.queue_name, callback=callback)

    def handle_sync_info(self, sync_info: Dict) -> None:
        """处理rabbitmq中的内容.

        :param sync_info: 同步内容
        """
        if sync_info["sync_type"] == IncidentSyncType.CREATE.value:
            self.create_incdent(sync_info)
        elif sync_info["sync_type"] == IncidentSyncType.UPDATE.value:
            self.update_incident(sync_info)

    def create_incident(self, sync_info: Dict) -> None:
        """根据同步信息，从AIOPS接口获取故障详情，并创建到监控的ES中.

        :param sync_info: 同步内容
        """
        # 生成故障归档记录
        incident_info = sync_info["incident_info"]
        incident_info["incident_id"] = sync_info["incident_id"]
        incident_info["id"] = f"{incident_info['create_time']}{sync_info['incident_id']}"
        incident_document = IncidentDocument(**incident_info)
        snapshot_info = api.bkdata.get_incident_snapshot(snapshot_id=sync_info["fpp_snapshot_id"])
        incident_document.generate_handlers(sync_info["scope"]["alerts"])
        incident_document.generate_assignees(snapshot_info)
        IncidentDocument.bulk_create([incident_document], action=BulkActionType.CREATE)

        # 生成故障快照记录
        IncidentSnapshotDocument.bulk_create(
            [
                IncidentSnapshotDocument(
                    incident_id=sync_info["incident_id"],
                    bk_biz_id=sync_info["scope"]["bk_biz_ids"],
                    status=incident_info["status"],
                    alerts=sync_info["scope"]["alerts"],
                    events=sync_info["scope"]["events"],
                    create_time=sync_info["sync_time"],
                    content=snapshot_info,
                    fpp_snapshot_id=sync_info["fpp_snapshot_id"],
                )
            ],
            action=BulkActionType.CREATE,
        )

        # 记录故障流转
        IncidentOperationManager.record_create_incident(
            incident_id=sync_info["incident_id"],
            operate_time=incident_info["create_time"],
            alert_count=len(sync_info["scope"]["alerts"]),
            assignees=incident_document.assignees,
        )

    def update_incident(self, sync_info: Dict) -> None:
        """根据同步信息，从AIOPS接口获取故障详情，并更新到监控的ES中.

        :param sync_info: 同步内容
        """
        # 更新故障归档记录
        incident_info = sync_info["incident_info"]
        incident_document = IncidentDocument(**incident_info)
        snapshot_info = api.bkdata.get_incident_snapshot(snapshot_id=sync_info["fpp_snapshot_id"])
        incident_document.generate_handlers(sync_info["scope"]["alerts"])
        incident_document.generate_assignees(snapshot_info)
        IncidentDocument.bulk_create([incident_document], action=BulkActionType.UPDATE)

        # 生成故障快照记录
        IncidentSnapshotDocument.bulk_create(
            [
                IncidentSnapshotDocument(
                    incident_id=sync_info["incident_id"],
                    bk_biz_id=sync_info["scope"]["bk_biz_ids"],
                    status=incident_info["status"],
                    alerts=sync_info["scope"]["alerts"],
                    events=sync_info["scope"]["events"],
                    create_time=sync_info["sync_time"],
                    content=snapshot_info,
                    fpp_snapshot_id=sync_info["fpp_snapshot_id"],
                )
            ],
            action=BulkActionType.CREATE,
        )

        # 记录故障流转
        for incident_key, update_info in sync_info["update_attributes"].items():
            IncidentOperationManager.record_update_incident(
                incident_id=sync_info["incident_id"],
                operate_time=incident_info["created_at"],
                incident_key=incident_key,
                from_value=update_info["from"],
                to_value=update_info["to"],
            )
