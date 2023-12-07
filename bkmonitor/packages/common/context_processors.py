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
import os
from typing import Any, Dict

from django.conf import settings
from django.utils.translation import get_language
from django.utils.translation import ugettext as _

from bkmonitor.commons.tools import is_ipv6_biz
from bkmonitor.utils import time_tools
from bkmonitor.utils.common_utils import fetch_biz_id_from_request, safe_int
from common.log import logger
from core.drf_resource import resource


class Platform(object):
    """
    平台信息
    """

    te = settings.BKAPP_DEPLOY_PLATFORM == "ieod"
    ee = settings.BKAPP_DEPLOY_PLATFORM == "enterprise"
    ce = settings.BKAPP_DEPLOY_PLATFORM == "community"


def get_default_biz_id(request, biz_list, id_key):

    sorted(biz_list, key=lambda biz: biz[id_key])

    if hasattr(request, "biz_id"):
        biz_id = request.biz_id
    else:
        biz_id = fetch_biz_id_from_request(request, {})
        if biz_id:
            biz_id = biz_id
        elif biz_list:
            biz_id = biz_id[0][id_key]
        else:
            biz_id = -1

    # 检查业务ID是否合法
    try:
        biz_id = int(biz_id)
    except (TypeError, ValueError):
        biz_id = -1

    return biz_id


def field_formatter(context: Dict[str, Any]):
    # 字段大小写标准化
    standard_context = {
        key.upper(): context[key]
        for key in context
        if key
        in [
            "is_superuser",
            "uin",
        ]
    }
    context.update(standard_context)


def json_formatter(context: Dict[str, Any]):
    # JSON 返回预处理
    context["PLATFORM"] = {key: getattr(context["PLATFORM"], key) for key in ["ce", "ee", "te"]}
    context["LANGUAGES"] = dict(context["LANGUAGES"])

    for key in ["gettext", "_"]:
        context.pop(key, None)

    bool_context: Dict[
        str,
    ] = {}
    for key, value in context.items():
        if isinstance(value, str) and value in ["false", "False", "true", "True"]:
            bool_context[key] = True if value in {"True", "true"} else False

    context.update(bool_context)


def get_core_context(request):
    return {
        # healthz 自监控引用
        "PLATFORM": Platform,
        "SITE_URL": settings.SITE_URL,
        # 静态资源
        "STATIC_URL": settings.STATIC_URL,
        # 当前页面，主要为了 login_required 做跳转用
        "APP_PATH": request.get_full_path(),
        "CSRF_COOKIE_NAME": settings.CSRF_COOKIE_NAME,
        # 默认开启APM
        "ENABLE_APM": "true",
        "ENABLE_APM_PROFILING": "true" if settings.APM_PROFILING_ENABLED else "false",
        "BK_JOB_URL": settings.JOB_URL,
        "BK_CC_URL": settings.BK_CC_URL,
        # 蓝鲸平台URL
        "BK_URL": settings.BK_URL,
        "BK_PAAS_HOST": settings.BK_PAAS_HOST,
        # bkchat 用户管理接口
        "BKCHAT_MANAGE_URL": settings.BKCHAT_MANAGE_URL,
        "CE_URL": settings.CE_URL,
        "BKLOGSEARCH_HOST": settings.BKLOGSEARCH_HOST,
        "BK_NODEMAN_HOST": settings.BK_NODEMAN_HOST,
        "TAM_ID": settings.TAM_ID,
        # 用于切换中英文用户管理 cookie
        "BK_COMPONENT_API_URL": settings.BK_COMPONENT_API_URL_FRONTEND,
        "BK_DOMAIN": os.getenv("BK_DOMAIN", ""),
        # 登录跳转链接
        "LOGIN_URL": settings.LOGIN_URL,
        # 用于文档链接跳转
        "BK_DOCS_SITE_URL": settings.BK_DOCS_SITE_URL,
        # 国际化
        "gettext": _,
        "_": _,
        "LANGUAGE_CODE": request.LANGUAGE_CODE,
        "LANGUAGES": settings.LANGUAGES,
        # 页面title
        "PAGE_TITLE": (
            settings.HEADER_FOOTER_CONFIG["header"][0]["en"]
            if get_language() == "en"
            else settings.HEADER_FOOTER_CONFIG["header"][0]["zh-cn"]
        ),
    }


def get_basic_context(request, space_list, bk_biz_id):

    context = get_core_context(request)
    context.update(
        {
            "uin": request.user.username,
            "is_superuser": str(request.user.is_superuser).lower(),
            "SPACE_LIST": space_list,
            "BK_BIZ_ID": bk_biz_id,
            # 服务拨测设置最大 duration
            "MAX_AVAILABLE_DURATION_LIMIT": settings.MAX_AVAILABLE_DURATION_LIMIT,
            # 所有图表渲染必须
            "GRAPH_WATERMARK": settings.GRAPH_WATERMARK,
            # 是否开启前端视图部分，按拓扑聚合的能力。（不包含对监控策略部分的功能）
            "ENABLE_CMDB_LEVEL": settings.IS_ACCESS_BK_DATA and settings.IS_ENABLE_VIEW_CMDB_LEVEL,
            # 事件中心一键拉取功能展示
            "ENABLE_CREATE_CHAT_GROUP": settings.ENABLE_CREATE_CHAT_GROUP,
            # 用于全局设置蓝鲸监控机器人发送图片是否开启
            "WXWORK_BOT_SEND_IMAGE": settings.WXWORK_BOT_SEND_IMAGE,
            # 用于策略是否展示实时查询
            "SHOW_REALTIME_STRATEGY": settings.SHOW_REALTIME_STRATEGY,
            # APM 是否开启 EBPF 功能
            "APM_EBPF_ENABLED": "true" if settings.APM_EBPF_ENABLED else "false",
        }
    )

    # 用于主机详情渲染
    context["HOST_DATA_FIELDS"] = (
        ["bk_host_id"] if is_ipv6_biz(context["BK_BIZ_ID"]) else ["bk_target_ip", "bk_target_cloud_id"]
    )

    # 智能配置页面渲染
    context["ENABLE_AIOPS"] = "false"
    try:
        # 判断是否在白名单中
        if settings.IS_ACCESS_BK_DATA and (
            not settings.AIOPS_BIZ_WHITE_LIST
            or {-1, safe_int(context["BK_BIZ_ID"])} & set(settings.AIOPS_BIZ_WHITE_LIST)
        ):
            context["ENABLE_AIOPS"] = "true"
    except Exception as e:
        logger.error(f"Get AIOPS_BIZ_WHITE_LIST Failed: {e}")

    return context


def get_extra_context(request, space):
    context = {
        # 首页跳转到文档配置页面需要
        "AGENT_SETUP_URL": settings.AGENT_SETUP_URL,
        # 用于导入导出配置
        "COLLECTING_CONFIG_FILE_MAXSIZE": settings.COLLECTING_CONFIG_FILE_MAXSIZE,
        # 用于仪表盘迁移
        "MIGRATE_GUIDE_URL": settings.MIGRATE_GUIDE_URL,
        # 用于healz判断是否容器化部署
        "IS_CONTAINER_MODE": settings.IS_CONTAINER_MODE,
        # "UPTIMECHECK_OUTPUT_FIELDS": settings.UPTIMECHECK_OUTPUT_FIELDS,
        # 用于新增空间是否展示其他
        "MONITOR_MANAGERS": settings.MONITOR_MANAGERS,
        # "UPTIMECHECK_OUTPUT_FIELDS": settings.UPTIMECHECK_OUTPUT_FIELDS,
        "CLUSTER_SETUP_URL": f"{settings.BK_BCS_HOST.rstrip('/')}/bcs/",
    }

    # 格式化业务列表并排序
    # 暂时不返回
    # try:
    #     context["BK_BIZ_LIST"] = [
    #         {"id": biz.bk_biz_id, "text": biz.display_name, "is_demo": biz.bk_biz_id == int(settings.DEMO_BIZ_ID)}
    #         for biz in resource.cc.get_app_by_user(request.user)
    #     ]
    # except:  # noqa
    #     context["BK_BIZ_LIST"] = []
    #
    # # 有权限的空间列表
    # try:
    #     context["SPACE_LIST"] = resource.commons.list_spaces()
    # except:  # noqa
    #     pass
    #
    # default_biz_id = get_default_biz_id(request, context["SPACE_LIST"], "id")

    # 用于新增容器空间地址
    if space and space.space_code:
        context["CLUSTER_SETUP_URL"] = f"{settings.BK_BCS_HOST.rstrip('/')}/bcs/{space.space_uid}/cluster"

    return context


def _get_full_monitor_context(request):
    return _get_monitor_context(request)


def _get_monitor_context(request):
    """
    渲染APP基础信息
    :param request:
    :return:
    """

    context = {
        # 基础信息
        "RUN_MODE": settings.RUN_MODE,
        "APP_CODE": settings.APP_CODE,
        "SPACE_LIST": [],
        # "MAIL_REPORT_BIZ": int(settings.MAIL_REPORT_BIZ),
        "STATIC_VERSION": settings.STATIC_VERSION,
        "BK_BCS_URL": settings.BK_BCS_HOST,
        # 当前页面，主要为了login_required做跳转用
        "APP_PATH": request.get_full_path(),
        "NOW": time_tools.localtime(time_tools.now()),
        "NICK": request.session.get("nick", ""),
        "AVATAR": request.session.get("avatar", ""),
        "MEDIA_URL": settings.MEDIA_URL,
        "REMOTE_STATIC_URL": settings.REMOTE_STATIC_URL,
        "WEIXIN_STATIC_URL": settings.WEIXIN_STATIC_URL,
        "WEIXIN_SITE_URL": settings.WEIXIN_SITE_URL,
        "RT_TABLE_PREFIX_VALUE": settings.RT_TABLE_PREFIX_VALUE,
        # "DOC_HOST": settings.DOC_HOST,
        # 首页跳转到文档配置页面需要
        "AGENT_SETUP_URL": settings.AGENT_SETUP_URL,
        # 用于仪表盘迁移
        "MIGRATE_GUIDE_URL": settings.MIGRATE_GUIDE_URL,
        # "UTC_OFFSET": time_tools.utcoffset_in_seconds() // 60,
        # "ENABLE_MESSAGE_QUEUE": "true" if settings.MESSAGE_QUEUE_DSN else "false",
        # "MESSAGE_QUEUE_DSN": settings.MESSAGE_QUEUE_DSN,
        # "ENABLE_GRAFANA": bool(settings.GRAFANA_URL),
        # 用于导入导出配置
        "COLLECTING_CONFIG_FILE_MAXSIZE": settings.COLLECTING_CONFIG_FILE_MAXSIZE,
        # 用于healz判断是否容器化部署
        "IS_CONTAINER_MODE": settings.IS_CONTAINER_MODE,
        # 用于新增空间是否展示其他
        "MONITOR_MANAGERS": settings.MONITOR_MANAGERS,
        # "UPTIMECHECK_OUTPUT_FIELDS": settings.UPTIMECHECK_OUTPUT_FIELDS,
    }

    # 格式化业务列表并排序
    # 暂时不返回
    # try:
    #     context["BK_BIZ_LIST"] = [
    #         {"id": biz.bk_biz_id, "text": biz.display_name, "is_demo": biz.bk_biz_id == int(settings.DEMO_BIZ_ID)}
    #         for biz in resource.cc.get_app_by_user(request.user)
    #     ]
    # except:  # noqa
    #     context["BK_BIZ_LIST"] = []

    # 有权限的空间列表
    try:
        context["SPACE_LIST"] = resource.commons.list_spaces()
    except:  # noqa
        pass

    default_biz_id = get_default_biz_id(request, context["SPACE_LIST"], "id")

    context.update(get_basic_context(request, context["SPACE_LIST"], default_biz_id))

    # 用于新增容器空间地址
    context["CLUSTER_SETUP_URL"] = f"{settings.BK_BCS_HOST.rstrip('/')}/bcs/"
    for space in context["SPACE_LIST"]:
        if context["BK_BIZ_ID"] == space["bk_biz_id"] and space["space_code"]:
            context["CLUSTER_SETUP_URL"] = f"{settings.BK_BCS_HOST.rstrip('/')}/bcs/{space['space_id']}/cluster"

    field_formatter(context)
    return context


def _get_full_fta_context(request):
    context = _get_full_monitor_context(request)
    # context["SITE_URL"] = f'{context["SITE_URL"]}fta/'
    context["PAGE_TITLE"] = _("故障自愈 | 蓝鲸智云")
    return context


def get_full_context(request):
    # 如果 old，仍走老路由
    if "fta" in request.get_full_path().split("/"):
        # 针对自愈的页面，进行特殊处理
        return _get_full_fta_context(request)
    else:
        return _get_full_monitor_context(request)


def get_context(request):
    # return get_full_context(request)
    try:
        if "old" in request.GET:
            get_full_context(request)
        else:
            # 背景：原来的 context 集成了全量业务列表拉取、用户有权限业务拉取，导致首屏打开耗时较长
            # 改造：前端仅拉取基础 context，待页面初始化后再拉取剩余 context
            return get_core_context(request)

    except Exception as e:
        logger.exception(f"get_context error: {e}")
        raise e
