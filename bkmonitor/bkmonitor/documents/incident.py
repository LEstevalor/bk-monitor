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
from django_elasticsearch_dsl.registries import registry
from elasticsearch_dsl import Search, field

from bkmonitor.documents.base import BaseDocument, Date
from constants.incident import IncidentStatus


@registry.register_document
class IncidentDocument(BaseDocument):
    REINDEX_ENABLED = True
    REINDEX_QUERY = Search().filter("term", status=IncidentStatus.ABNORMAL.value).to_dict()

    incident_id = field.Keyword(required=True)
    incident_name = field.Text()  # 故障名称
    incident_reason = field.Text()  # 故障原因
    status = field.Keyword()  # 故障状态
    level = field.Keyword()  # 故障级别
    assignee = field.Keyword(multi=True)  # 故障负责人
    handler = field.Keyword(multi=True)  # 故障处理人
    labels = field.Keyword(multi=True)  # 标签

    # 故障创建时间(服务器时间)
    create_time = Date(format=BaseDocument.DATE_FORMAT)
    update_time = Date(format=BaseDocument.DATE_FORMAT)

    # 故障开始时间
    begin_time = Date(format=BaseDocument.DATE_FORMAT)
    # 故障结束时间
    end_time = Date(format=BaseDocument.DATE_FORMAT)
    # 故障持续的最新时间
    latest_time = Date(format=BaseDocument.DATE_FORMAT)

    # 故障维度信息
    dimensions = field.Object(enabled=False)
    # 故障额外信息，用于存放其他内容
    extra_info = field.Object(enabled=False)

    class Index:
        name = "bkmonitor_aiops_incident"
        settings = {"number_of_shards": 3, "number_of_replicas": 1, "refresh_interval": "1s"}


@registry.register_document
class IncidentSnapshotDocument(BaseDocument):
    id = field.Keyword(required=True)
    incident_id = field.Keyword()  # 故障ID
    bk_biz_id = field.Keyword(multi=True)  # 故障影响的业务列表
    status = field.Keyword()  # 故障当前快照状态
    alerts = field.Keyword(multi=True)  # 故障关联的告警
    events = field.Keyword(multi=True)  # 故障关联的事件

    # 故障快照创建时间(服务器时间)
    create_time = Date(format=BaseDocument.DATE_FORMAT)
    update_time = Date(format=BaseDocument.DATE_FORMAT)

    content = field.Object()  # 故障内容
    graph_snapshot_id = field.Keyword()  # 故障当前快照的图谱快照ID

    # 故障额外信息，用于存放其他内容
    extra_info = field.Object(enabled=False)

    class Index:
        name = "bkmonitor_aiops_incident_snapshot"
        settings = {"number_of_shards": 3, "number_of_replicas": 1, "refresh_interval": "1s"}


@registry.register_document
class IncidentOperationDocument(BaseDocument):
    id = field.Keyword(required=True)
    incident_id = field.Keyword()  # 故障ID
    operation_type = field.Keyword()  # 故障操作类型

    # 故障流水创建时间和更新时间
    create_time = Date(format=BaseDocument.DATE_FORMAT)
    update_time = Date(format=BaseDocument.DATE_FORMAT)

    # 故障操作额外信息，用于存放其他内容，每种操作类型内容不一样
    extra_info = field.Object(enabled=False)

    class Index:
        name = "bkmonitor_aiops_incident_operation"
        settings = {"number_of_shards": 3, "number_of_replicas": 1, "refresh_interval": "1s"}


@registry.register_document
class IncidentNoticeDocument(BaseDocument):
    id = field.Keyword(required=True)
    incident_id = field.Keyword()  # 故障ID
    notice_id = field.Keyword()  # 通知ID，一个故障的一次通知的统一ID，包含要通知的所有人及多种通知方式

    notify_way = field.Keyword()  # 通知方式
    receiver = field.Keyword()  # 接收人

    # 故障通知流水创建时间和更新时间
    create_time = Date(format=BaseDocument.DATE_FORMAT)
    update_time = Date(format=BaseDocument.DATE_FORMAT)

    # 故障通知流水额外信息，用于存放失败时的异常信息
    extra_info = field.Object(enabled=False)

    class Index:
        name = "bkmonitor_aiops_incident_notice"
        settings = {"number_of_shards": 3, "number_of_replicas": 1, "refresh_interval": "1s"}
