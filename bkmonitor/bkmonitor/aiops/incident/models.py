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
from dataclasses import dataclass


@dataclass
class IncidentGraphRank:
    """
    "rank_id": 0,
    "rank_name": "service_module",
    "rank_alias": "服务模块"
    """

    rank_id: int
    rank_name: str
    rank_alias: str


@dataclass
class IncidentGraphEntity:
    """
    "entity_id": "BCS-K8S-26245#k8s-idc-br#uid-0",
    "entity_type": "BcsPod",
    "is_anomaly": false,
    "anomaly_score": 0.3333333333333333,
    "anomaly_type": "死机/重启",
    "is_root": false,
    "product_hierarchy_rank": "rank_0"
    """

    entity_id: str
    entity_type: str
    is_anomaly: bool
    anomaly_score: float
    anomaly_type: str
    is_root: bool
    product_hierarchy_rank: IncidentGraphRank


@dataclass
class IncidentGraphEdge:
    """
    "source_type": "BkNodeHost",
    "target_type": "BcsPod",
    "source_id": "0#xx.xx.xx.xx",
    "target_id": "BCS-K8S-26245#k8s-idc-br#uid-0"
    """

    source: IncidentGraphEntity
    target: IncidentGraphEntity
