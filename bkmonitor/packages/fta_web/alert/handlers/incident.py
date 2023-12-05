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
import operator
from functools import reduce
from typing import Dict, List

from django.utils.translation import ugettext as _
from django.utils.translation import ugettext_lazy as _lazy
from django_elasticsearch_dsl.search import Search
from elasticsearch_dsl import Q
from elasticsearch_dsl.response import Response
from elasticsearch_dsl.utils import AttrList

from bkmonitor.documents.incident import IncidentDocument
from constants.incident import IncidentLevel, IncidentStatus
from packages.fta_web.alert.handlers.base import (
    BaseBizQueryHandler,
    BaseQueryTransformer,
    QueryField,
)
from packages.fta_web.alert.handlers.translator import BizTranslator


class IncidentQueryTransformer(BaseQueryTransformer):
    NESTED_KV_FIELDS = {"tags": "tags"}
    VALUE_TRANSLATE_FIELDS = {
        "level": IncidentLevel.get_enum_translate_list(),
        "status": IncidentStatus.get_enum_translate_list(),
    }
    """
    incident_id = field.Keyword(required=True)
    incident_name = field.Text()  # 故障名称
    incident_reason = field.Text()  # 故障原因
    status = field.Keyword()  # 故障状态
    level = field.Keyword()  # 故障级别
    assignees = field.Keyword(multi=True)  # 故障负责人
    handlers = field.Keyword(multi=True)  # 故障处理人
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
    """
    query_fields = [
        QueryField("incident_id", _lazy("故障ID")),
        QueryField("incident_name", _lazy("故障名称")),
        QueryField("incident_reason", _lazy("故障原因")),
        QueryField("status", _lazy("故障状态")),
        QueryField("level", _lazy("故障级别")),
        QueryField("assignees", _lazy("负责人")),
        QueryField("handlers", _lazy("处理人")),
        QueryField("labels", _lazy("标签")),
        QueryField("create_time", _lazy("故障检出时间")),
        QueryField("update_time", _lazy("故障更新时间")),
        QueryField("begin_time", _lazy("故障开始时间")),
        QueryField("end_time", _lazy("故障结束时间")),
    ]
    doc_cls = IncidentDocument


class IncidentQueryHandler(BaseBizQueryHandler):
    """
    故障查询
    """

    query_transformer = IncidentQueryTransformer

    # “我的故障” 状态名称
    MINE_STATUS_NAME = "MINE"
    MY_ASSIGNEE_STATUS_NAME = "MY_ASSIGNEE"
    MY_HANDLER_STATUS_NAME = "MY_HANDLER"

    def __init__(self, bk_biz_ids: List[int] = None, username: str = "", status: List[str] = None, **kwargs):
        super(IncidentQueryHandler, self).__init__(bk_biz_ids, username, **kwargs)
        self.status = [status] if isinstance(status, str) else status
        if not self.ordering:
            # 默认排序
            self.ordering = ["status", "-create_time"]

    def get_search_object(self, start_time: int = None, end_time: int = None):
        """
        获取查询对象
        """
        start_time = start_time or self.start_time
        end_time = end_time or self.end_time

        search_object = IncidentDocument.search(start_time=self.start_time, end_time=self.end_time)

        if start_time and end_time:
            search_object = search_object.filter(
                (Q("range", end_time={"gte": start_time}) | ~Q("exists", field="end_time"))
                & (Q("range", begin_time={"lte": end_time}) | Q("range", create_time={"lte": end_time}))
            )

        search_object = self.add_biz_condition(search_object)

        if self.status:
            queries = []
            for status in self.status:
                if status == self.MINE_STATUS_NAME:
                    queries.append(
                        Q("term", assignees=self.request_username) | Q("term", appointee=self.request_username)
                    )
                if status == self.MY_ASSIGNEE_STATUS_NAME:
                    queries.append(Q("term", assignees=self.request_username))
                if status == self.MY_HANDLER_STATUS_NAME:
                    queries.append(Q("term", handlers=self.request_username))
                else:
                    queries.append(Q("term", status=status))

            if queries:
                search_object = search_object.filter(reduce(operator.or_, queries))

        return search_object

    def search(self, show_overview: bool = False, show_aggs: bool = False) -> Dict:
        search_object = self.get_search_object()
        search_object = self.add_conditions(search_object)
        search_object = self.add_query_string(search_object)
        search_object = self.add_ordering(search_object)
        search_object = self.add_pagination(search_object)

        if show_overview:
            search_object = self.add_overview(search_object)

        if show_aggs:
            search_object = self.add_aggs(search_object)

        search_result = search_object.execute()
        incidents = self.handle_hit_list(search_result.hits)
        BizTranslator().translate_from_dict(incidents, "bk_biz_id", "bk_biz_name")

        result = {
            "total": min(search_result.hits.total.value, 10000),
            "incidents": incidents,
        }

        if show_overview:
            result["overview"] = self.handle_overview(search_result)

        if show_aggs:
            result["aggs"] = self.handle_aggs(search_result)

        return result

    def add_biz_condition(self, search_object: Search) -> Search:
        queries = []
        if self.authorized_bizs is not None and self.bk_biz_ids:
            # 进行我有权限的告警过滤
            queries.append(Q("terms", **{"bk_biz_id": self.authorized_bizs}))

        user_condition = Q(
            Q("term", assignee=self.request_username)
            | Q("term", appointee=self.request_username)
            | Q("term", supervisor=self.request_username)
        )
        if self.bk_biz_ids == []:
            # 如果不带任何业务信息，表示获取跟自己相关的告警
            queries.append(user_condition)

        if self.unauthorized_bizs and self.request_username:
            queries.append(Q(Q("terms", **{"bk_biz_id": self.unauthorized_bizs}) & user_condition))

        if queries:
            return search_object.filter(reduce(operator.or_, queries))
        return search_object

    @classmethod
    def handle_hit_list(cls, hits: AttrList = None) -> List[Dict]:
        hits = hits or []
        incidents = [cls.handle_hit(hit) for hit in hits]
        return incidents

    def date_histogram(self, interval: str = "auto") -> Dict:
        interval = self.calculate_agg_interval(self.start_time, self.end_time, interval)
        search_object = self.get_search_object()
        search_object = self.add_conditions(search_object)
        search_object = self.add_query_string(search_object)
        search_object = self.add_pagination(search_object, page_size=0)

        search_object.aggs.bucket(
            "group_by_histogram",
            "date_histogram",
            field="time",
            fixed_interval=f"{interval}s",
            format="epoch_millis",
            min_doc_count=0,
            extended_bounds={"min": self.start_time * 1000, "max": self.end_time * 1000},
        )

        search_result = search_object.execute()
        if not search_result.aggs:
            series_data = []
        else:
            series_data = [
                [int(bucket.key_as_string), bucket.doc_count]
                for bucket in search_result.aggs.group_by_histogram.buckets
            ]

        result_data = {
            "series": [{"data": series_data, "name": _("当前")}],
            "unit": "",
        }
        return result_data

    def add_overview(self, search_object: Search) -> Search:
        """补充检索全览的检索结构.

        :param search_object: 检索结构
        :return: 包含全览的检索结构
        """
        return search_object

    def handle_overview(self, search_result: Response) -> Dict:
        """处理返回内容中的检索全览部分.

        :param search_result: 检索结果
        :return: 故障全览内容
        """
        return {
            "children": [
                {
                    "id": self.MY_ASSIGNEE_STATUS_NAME,
                    "name": _("我负责的"),
                    "count": 100,
                },
                {
                    "id": self.MY_HANDLER_STATUS_NAME,
                    "name": _("我收到的"),
                    "count": 100,
                },
                {
                    "id": "abnormal",
                    "name": _("未恢复"),
                    "count": 60,
                },
                {
                    "id": "recovering",
                    "name": _("观察中"),
                    "count": 20,
                },
                {
                    "id": "recovered",
                    "name": _("已恢复"),
                    "count": 10,
                },
                {
                    "id": "closed",
                    "name": _("已解决"),
                    "count": 10,
                },
            ],
            "count": 100,
            "id": "incident",
            "name": _("故障"),
        }

    def add_aggs(self, search_object: Search) -> Search:
        """补充检索聚合统计的检索结构.

        :param search_object: 检索结构
        :return: 包含聚合统计的检索结构
        """
        return search_object

    def handle_aggs(self, search_result: Response) -> Dict:
        """处理返回内容中的检索聚合统计部分.

        :param search_result: 检索结果
        :return: 故障聚合统计内容
        """
        return [
            {
                "id": "level",
                "name": _("级别"),
                "count": 100,
                "children": [
                    {
                        "id": 1,
                        "count": 60,
                        "name": _("致命"),
                    },
                    {
                        "id": 2,
                        "count": 30,
                        "name": _("预警"),
                    },
                    {
                        "id": 3,
                        "count": 10,
                        "name": _("提醒"),
                    },
                ],
            }
        ]

    def top_n(self, fields: List, size=10, translators: dict = None) -> Dict:
        return super(IncidentQueryHandler, self).top_n(fields, size, translators)
