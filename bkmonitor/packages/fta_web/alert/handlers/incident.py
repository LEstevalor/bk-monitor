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
from typing import Dict, List

from django.utils.translation import ugettext as _
from django.utils.translation import ugettext_lazy as _lazy
from django_elasticsearch_dsl.search import Search
from elasticsearch_dsl.utils import AttrList

from bkmonitor.documents.incident import IncidentDocument
from constants.incident import IncidentLevel, IncidentStatus
from fta_web.alert.handlers.base import (
    BaseQueryHandler,
    BaseQueryTransformer,
    QueryField,
)
from fta_web.alert.handlers.translator import AbstractTranslator


class IncidentQueryTransformer(BaseQueryTransformer):
    NESTED_KV_FIELDS = {"tags": "tags"}
    VALUE_TRANSLATE_FIELDS = {
        "level": IncidentLevel,
        "status": IncidentStatus,
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


class IncidentQueryHandler(BaseQueryHandler):
    """
    故障查询
    """

    query_transformer = IncidentQueryTransformer

    def __init__(self, dedupe_md5: str = "", **kwargs) -> None:
        super(IncidentQueryHandler, self).__init__(**kwargs)
        self.dedupe_md5 = dedupe_md5

        if not self.ordering:
            # 默认排序
            self.ordering = ["-time"]

    def get_search_object(self) -> Search:
        search_object = IncidentDocument.search(all_indices=True).filter(
            "range", time={"gte": self.start_time, "lte": self.end_time}
        )

        if self.dedupe_md5:
            search_object = search_object.filter("term", dedupe_md5=self.dedupe_md5)

        return search_object

    def search(self, show_dsl: bool = False) -> Dict:
        search_object = self.get_search_object()
        search_object = self.add_conditions(search_object)
        search_object = self.add_query_string(search_object)
        search_object = self.add_ordering(search_object)
        search_object = self.add_pagination(search_object)

        if show_dsl:
            return {"dsl": search_object.to_dict()}

        search_result = search_object.execute()
        incidents = self.handle_hit_list(search_result.hits)

        result = {
            "total": min(search_result.hits.total.value, 10000),
            "incidents": incidents,
        }

        return result

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

    def top_n(self, fields: List, size=10, translators: Dict[str, AbstractTranslator] = None):
        translators = {}
        return super(IncidentQueryHandler, self).top_n(fields, size, translators)
