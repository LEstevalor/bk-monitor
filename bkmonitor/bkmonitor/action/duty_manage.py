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
import calendar
import logging
from datetime import datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta
from django.db.models import Q

from bkmonitor.models import DutyPlan, DutyRule, DutyRuleSnap, UserGroup
from bkmonitor.utils import time_tools
from constants.common import DutyGroupType, RotationType, WorkTimeType

logger = logging.getLogger("fta_action.run")


class DutyCalendar:
    @classmethod
    def get_end_time(cls, end_date, handover_time):
        """
        获取结束时间
        """
        try:
            [hour, minute] = handover_time.split(":")
            hour = int(hour)
            minute = int(minute)
        except BaseException as error:
            logger.exception("[get_handover_time] split handover_time(%s) error, %s", handover_time, str(error))
            hour, minute = 0, 0
        end_time = datetime(year=end_date.year, month=end_date.month, day=end_date.day, hour=hour, minute=minute)
        return datetime.fromtimestamp(end_time.timestamp(), tz=timezone.utc)

    @staticmethod
    def get_daily_rotation_end_time(begin_time: datetime, handoff_time):
        """
        获取按天轮转的结束时间
        """
        begin_time = time_tools.localtime(begin_time)
        handover_time = handoff_time["time"]
        if handover_time > time_tools.strftime_local(begin_time, "%H:%M"):
            end_date = begin_time.date()
        else:
            end_date = (begin_time + timedelta(days=1)).date()
        return DutyCalendar.get_end_time(end_date, handover_time)

    @staticmethod
    def get_weekly_rotation_end_time(begin_time: datetime, handoff_time):
        """
        获取按周轮转的结束时间
        """
        begin_time = time_tools.localtime(begin_time)
        begin_week_day = begin_time.isoweekday()
        handover_date = handoff_time["date"]
        handover_time = handoff_time["time"]
        if handover_date > begin_week_day:
            end_date = (begin_time + timedelta(days=handover_date - begin_week_day)).date()
        elif handover_date == begin_week_day and handover_time > time_tools.strftime_local(begin_time, "%H:%M"):
            end_date = begin_time.date()
        else:
            end_date = (begin_time + timedelta(days=handover_date + 7 - begin_week_day)).date()
        return DutyCalendar.get_end_time(end_date, handover_time)

    @staticmethod
    def get_monthly_rotation_end_time(begin_time: datetime, handoff_time):
        """
        获取按月进行轮转的结束时间
        """
        begin_time = time_tools.localtime(begin_time)
        begin_month_day = begin_time.day
        handover_date = handoff_time["date"]
        handover_time = handoff_time["time"]
        _, max_current_month_day = calendar.monthrange(begin_time.year, begin_time.month)

        if max_current_month_day >= handover_date > begin_month_day:
            handover_date = min(handover_date, max_current_month_day)
            end_date = (begin_time + timedelta(days=(handover_date - begin_month_day))).date()
        elif handover_date == begin_month_day and handover_time > time_tools.strftime_local(begin_time, "%H:%M"):
            end_date = begin_time.date()
        else:
            next_month = begin_time.date() + relativedelta(months=1)
            _, max_month_day = calendar.monthrange(next_month.year, next_month.month)
            handover_date = min(handover_date, max_month_day)
            end_date = datetime(next_month.year, next_month.month, handover_date)
        return DutyCalendar.get_end_time(end_date, handover_time)


class DutyRuleManager:
    """
    轮值规则管理模块
    """

    def __init__(
        self, duty_rule, begin_time: str = None, days=0, last_user_index=0, last_time_index=0, end_time: str = None
    ):
        self.duty_arranges = duty_rule["duty_arranges"]
        self.category = duty_rule.get("category")
        begin_time = begin_time or ""
        self.begin_time = time_tools.str2datetime(max(begin_time, duty_rule["effective_time"]))
        self.end_time = None
        self.last_user_index = last_user_index
        self.last_time_index = last_time_index
        if end_time:
            self.end_time = time_tools.str2datetime(end_time)
        else:
            if not duty_rule["end_time"] and not days:
                # 如果本来没有设置结束时间，和预览天数，默认用30天
                days = 30
            if days:
                # 如果指定的预览天数，结束时间按照预览天数来计算
                self.end_time = self.begin_time + timedelta(days=days)
            else:
                # 其他情况直接按照
                self.end_time = time_tools.str2datetime(duty_rule["end_time"])

    def get_duty_plan(self):
        """
        获取轮值计算排班入口
        """
        if self.category == "regular":
            return self.get_regular_duty_plan()
        return self.get_rotation_duty_plan()

    def get_duty_dates(self, duty_time, special_rotation=False, period_interval=0):
        """
        根据一个轮班设置获取指定时间范围内的有效日期（按天获取）
        """
        date_ranges = []
        weekdays = []
        days = []
        duty_dates = []
        work_days = self.get_work_days(duty_time)
        if duty_time["work_type"] == RotationType.DATE_RANGE:
            # 如果是根据时间返回来获取的, 则根据时间范围来获取
            for item in duty_time["work_date_range"]:
                # 如果开始至结束期间，只要当前日期满足日期范围，就符合条件
                [begin_date, end_date] = item.split("--")
                date_ranges.append((begin_date, end_date))
        elif duty_time["work_type"] in RotationType.WEEK_MODE:
            # 按照周来处理的
            weekdays = work_days
        elif duty_time["work_type"] == RotationType.MONTHLY:
            # 按照月来轮班的情况
            days = work_days
        begin_time = (
            time_tools.str2datetime(duty_time["begin_time"]) if duty_time.get("begin_time") else self.begin_time
        )
        # 只有按周，按月才有对应的交接工作日，就是页面配置的起始日期

        handoff_date = work_days[0] if work_days else None
        period_dates = []
        # 标记最近一次交接时间
        last_handoff_time = self.end_time - timedelta(days=1)
        while begin_time <= last_handoff_time:
            # 在有效的时间范围内，获取有效的排期
            is_valid = False
            # 如果是指定
            begin_date = begin_time.strftime("%Y-%m-%d")
            next_day_time = begin_time + timedelta(days=1)

            # 是否为新的周期，只有那种需要指定班次轮值的情况下才生效，所以其他场景默认都为新的周期就好
            new_period = (
                self.is_new_period(duty_time["work_type"], handoff_date, next_day_time) if special_rotation else True
            )

            if (
                duty_time["work_type"] == RotationType.DAILY
                or begin_time.isoweekday() in weekdays
                or begin_time.day in days
            ):
                # 如果是每天都轮班，则一定生效
                # 如果是按周轮班，当天在工作日内
                # 如果按月轮班，当天在工作日内
                is_valid = True
            else:
                for date_range in date_ranges:
                    if date_range[0] <= begin_date <= date_range[1]:
                        is_valid = True
                        break

            if is_valid:
                period_dates.append(begin_time.date())

            if period_interval and len(period_dates) % period_interval:
                # 如果是通过系统自动排班日期的，则以是否能够整除为准
                new_period = False

            if special_rotation and new_period and period_dates:
                # 如果是一个新的周期，原来的安排归档，开始一个新的周期计算
                duty_dates.append(period_dates)
                period_dates = []

            if new_period is False and last_handoff_time < next_day_time:
                # 如果不是一个新的周期，表示要继续
                last_handoff_time = next_day_time
            begin_time = next_day_time
        if special_rotation and period_dates:
            # 如果需要轮转并且最后一个周期日期还没有合入，添加到结果中， 这种情况一般是最后一次循环跳出没有合入
            duty_dates.append(period_dates)
        # 更新当前时间段的下一次排班交接时间
        duty_time["begin_time"] = time_tools.datetime2str(last_handoff_time + timedelta(days=1))
        return duty_dates if special_rotation else period_dates

    @staticmethod
    def get_work_days(duty_time):
        """
        获取轮值的有效工作日
        """
        if duty_time.get("work_time_type") != WorkTimeType.DATETIME_RANGE:
            return duty_time.get("work_days", [])

        # 定义时间范围的一个最大日期
        max_work_day = 7 if duty_time["work_type"] in RotationType.WEEK_MODE else 31
        for work_time in duty_time["work_time"]:
            # 起止时间的场景下，只有一个工作时间段
            [start_time, end_time] = work_time.split("--")
            start_work_day = int(start_time[:2])
            end_work_day = int(end_time[:2])
            if start_work_day < end_work_day:
                # 如果开始小于结束，则表示是一周范围之内的
                work_days = list(range(start_work_day, end_work_day + 1))
            else:
                # 如果是大于于，需要分成两段
                # 第一段 是开始时间至最大结束时间
                first_stage = list(range(start_work_day, max_work_day + 1))
                second_stage = list(range(1, end_work_day + 1))
                work_days = first_stage + second_stage
            #  只有一个时间范围，直接返回
            return work_days

    @staticmethod
    def is_new_period(work_type, handoff_date, next_day_time: datetime):
        """
        判断是否为新的周期，只有那种需要指定班次轮值的情况下才生效，所以其他场景默认都为新的周期就好
        """
        new_period = False
        if work_type == RotationType.DAILY:
            new_period = True
        elif work_type in RotationType.WEEK_MODE and next_day_time.isoweekday() == handoff_date:
            # 按周轮转，如果下一天为交接日期，表示将会开启一个新的交接
            new_period = True
        elif work_type == RotationType.MONTHLY and next_day_time.day == handoff_date:
            # 按月轮转，如果下一天为交接日期，表示将会开启一个新的交接
            new_period = True
        return new_period

    def get_auto_hour_periods(self, duty_time):
        # TODO 获取根据小时轮转的周期
        return []

    def get_regular_duty_plan(self):
        """
        获取常规轮值的排班计划
        """
        duty_plans = []
        for index, duty_arrange in enumerate(self.duty_arranges):
            work_time = []
            for duty_time in duty_arrange["duty_time"]:
                duty_dates = self.get_duty_dates(duty_time)
                for work_date in duty_dates:
                    # 获取到有效的日期，进行排班
                    work_time.extend(self.get_time_range_work_time(work_date, duty_time["work_time"]))

            if work_time:
                duty_plans.append(
                    {"users": duty_arrange["duty_users"][0], "user_index": index, "work_times": work_time}
                )
        return duty_plans

    def get_rotation_duty_plan(self):
        """
        获取轮值周期排班
        """
        duty_plans = []
        if not self.duty_arranges:
            return []
        # 轮值情况下只有一个
        duty_arrange = self.duty_arranges[0]

        duty_users = duty_arrange["duty_users"]
        duty_times = duty_arrange["duty_time"]
        group_user_number = 1
        period_interval = 1
        if duty_arrange["group_type"] == DutyGroupType.AUTO:
            # 如果人员信息为自动
            group_user_number = duty_arrange["group_number"]
            duty_users = duty_users[0]
        duty_date_times = []
        special_rotation = True
        for duty_time in duty_times:
            period_settings = duty_time.get("period_settings")
            if period_settings:
                # 如果有进行自动按照天数或者小时轮值的，计算出来有效的轮值天数
                special_rotation = False
                period_interval = period_settings["duration"]
                duty_date_times.extend(
                    [
                        {"date": one_date, "work_time_list": duty_time["work_time"]}
                        for one_date in self.get_duty_dates(duty_time, period_interval=period_interval)
                    ]
                )
                break
            # 没有进行自动计算的情况，需要做轮值获取
            # 一般来说一个需要轮转的规则里，轮值类型都是一样的
            period_duty_dates = self.get_duty_dates(duty_time, special_rotation=True)

            period_duty_date_times = []
            for one_period_dates in period_duty_dates:
                period_duty_date_times.append(
                    [
                        {
                            "date": one_date,
                            "work_time_type": duty_time["work_time_type"],
                            "work_type": duty_time["work_type"],
                            "work_time_list": duty_time["work_time"],
                        }
                        for one_date in one_period_dates
                    ]
                )

            duty_date_times.append(period_duty_date_times)

        if special_rotation:
            # 如果是进行轮转的，需要做轮值时间周期打平
            duty_date_times = self.flat_rotation_duty_dates(duty_date_times)
        date_index = 0
        while date_index < len(duty_date_times):
            # 根据配置的有效时间进行轮转
            current_duty_dates = duty_date_times[date_index : date_index + period_interval]
            date_index = date_index + period_interval
            # 根据设置的用户数量进行轮转
            current_user_index = self.last_user_index
            users, self.last_user_index = self.get_group_duty_users(
                duty_users, self.last_user_index, group_user_number, duty_arrange["group_type"]
            )
            duty_work_time = []
            for one_period_dates in current_duty_dates:
                if not isinstance(one_period_dates, list):
                    one_period_dates = [one_period_dates]
                for day in one_period_dates:
                    if day.get("work_time_type") == WorkTimeType.DATETIME_RANGE:
                        duty_work_time.extend(
                            self.get_datetime_range_work_time(day["date"], day["work_time_list"], day["work_type"])
                        )

                        continue

                    duty_work_time.extend(self.get_time_range_work_time(day["date"], day["work_time_list"]))

            duty_plans.append({"users": users, "user_index": current_user_index, "work_times": duty_work_time})
        return duty_plans

    @staticmethod
    def flat_rotation_duty_dates(duty_dates):
        """
        将有效的排班日期打平
        """
        max_column_len = max(len(period_column) for period_column in duty_dates)
        new_duty_dates = []
        for column in range(0, max_column_len):
            for row in range(0, len(duty_dates)):
                if len(duty_dates[row]) <= column:
                    # 如果当前的列数已经小于轮询的列
                    break
                new_duty_dates.append(duty_dates[row][column])
        return new_duty_dates

    @staticmethod
    def get_group_duty_users(duty_users, user_index, group_user_number, group_type=DutyGroupType.SPECIFIED):
        """
        获取自动分组的下一个小组成员
        """
        if len(duty_users) < group_user_number or len(duty_users) <= user_index:
            # 如果配置的用户比自动分组的用户还少，直接返回
            return duty_users, 0
        next_user_index = user_index + group_user_number
        if group_type == DutyGroupType.AUTO:
            users = duty_users[user_index:next_user_index]
        else:
            users = duty_users[user_index]
        if next_user_index >= len(duty_users):
            # 重置user_index 为 0
            next_user_index = user_index = 0
            if group_type == DutyGroupType.AUTO:
                # 如果自动分组，需要补齐人数
                next_user_index = group_user_number - len(users)
                users.extend(duty_users[user_index:next_user_index])
        return users, next_user_index

    @staticmethod
    def get_time_range_work_time(work_date, work_time_list: list):
        duty_work_time = []
        for time_range in work_time_list:
            # TODO 根据日期时间范围的还未处理
            [start_time, end_time] = time_range.split("--")
            start_date = end_date = work_date

            if start_time >= end_time:
                # 如果开始时间段 大于或者等于的情况下 结束时间段表示有跨天
                end_date += timedelta(days=1)

            duty_work_time.append(
                dict(
                    start_time="{date} {start_time}".format(
                        date=start_date.strftime("%Y-%m-%d"), start_time=start_time
                    ),
                    end_time="{date} {end_time}".format(date=end_date.strftime("%Y-%m-%d"), end_time=end_time),
                )
            )
        return duty_work_time

    @staticmethod
    def get_datetime_range_work_time(work_date: datetime, work_time_list: list, work_type):
        """
        根据日期时间范围的类型获取工作时间
        """
        duty_work_time = []
        time_range = work_time_list[0]
        [start_time, finished_time] = time_range.split("--")
        begin_time = "00:00"
        end_time = "23:59"
        weekday = day = 0
        begin_date = int(start_time[:2])
        end_day = int(finished_time[:2])
        cross_day = False
        if begin_date == end_day:
            # 如果开始日期==结束日期，表示最后一天存在跨天的场景，为前一天至截止时间
            cross_day = True
            end_day -= 1

        #     计算出当前工作日的时间
        if work_type in RotationType.WEEK_MODE:
            weekday = work_date.isoweekday()
            max_work_day = 7
        else:
            day = work_date.day
            _, max_work_day = calendar.monthrange(work_date.year, work_date.month)

        if end_day == 0:
            # 如果当前结束时间为0，对应前一天为最后一天
            end_date = max_work_day

        if weekday == begin_date or day == begin_date:
            # 当前为第一天的时候，起点时间以配置时间为准
            begin_time = start_time[3:].strip()

        is_last_day = False
        if weekday == end_day or day == end_day:
            # 当前为最后一天的时候，结束时间以配置时间为准
            end_time = finished_time[3:].strip()
            is_last_day = True

        begin_date = end_date = work_date
        if cross_day and is_last_day:
            # 如果开始时间段 大于 结束时间段表示有跨天
            end_date += timedelta(days=1)

        duty_work_time.append(
            dict(
                start_time="{date} {start_time}".format(date=begin_date.strftime("%Y-%m-%d"), start_time=begin_time),
                end_time="{date} {end_time}".format(date=end_date.strftime("%Y-%m-%d"), end_time=end_time),
            )
        )
        return duty_work_time


class GroupDutyRuleManager:
    """
    告警组的轮值规则管理
    """

    def __init__(self, user_group: UserGroup, duty_rules):
        self.user_group = user_group
        self.duty_rules = duty_rules

    def manage_duty_rule_snap(self, task_time):
        """
        :param task_time:
        :return:
        """
        # task_time需要提前定义, 这个可以是七天以后的一个时间

        new_duty_snaps = {}
        logger.info("[manage_duty_rule_snap] begin to manage duty snap for current_time(%s)", task_time)
        for duty_rule_snap in self.duty_rules:
            #  将已经生效的轮值规则存快照
            if not duty_rule_snap["enabled"]:
                # 如果当前是禁用状态，忽略
                continue
            next_plan_time = max(duty_rule_snap["effective_time"], task_time)
            new_duty_snaps.update(
                {
                    f"{self.user_group.id}--{duty_rule_snap['id']}": DutyRuleSnap(
                        enabled=duty_rule_snap["enabled"],
                        next_plan_time=next_plan_time,
                        next_user_index=0,
                        end_time=duty_rule_snap["end_time"],
                        user_group_id=self.user_group.id,
                        first_effective_time=next_plan_time,
                        duty_rule_id=duty_rule_snap["id"],
                        rule_snap=duty_rule_snap,
                    )
                }
            )
        no_changed_duties = []
        changed_duties = []
        duty_rule_ids = self.user_group.duty_rules
        for rule_snap in DutyRuleSnap.objects.filter(
            duty_rule_id__in=duty_rule_ids, user_group_id=self.user_group.id, enabled=True
        ):
            if not new_duty_snaps.get(f"{self.user_group.id}--{rule_snap.duty_rule_id}"):
                # 如果对应的duty_rule不存在，则表示已删除或者被禁用
                continue
            new_snap = new_duty_snaps.get(f"{self.user_group.id}--{rule_snap.duty_rule_id}").rule_snap
            if new_snap["hash"] == rule_snap.rule_snap["hash"]:
                # 如果hash没有发生任何变化，不做改动
                no_changed_duties.append(f"{rule_snap.user_group_id}--{rule_snap.duty_rule_id}")
            else:
                changed_duties.append(rule_snap)

        # 过滤出已经被禁用的规则, 如果被禁用了， 需要及时删除
        disabled_duty_rules = DutyRule.objects.filter(enabled=False).values_list("id", flat=True)
        if disabled_duty_rules:
            # 如果有有禁用的，需要删除掉
            DutyRuleSnap.objects.filter(duty_rule_id__in=disabled_duty_rules, user_group_id=self.user_group.id).delete()

            # 已经设置的好的排班计划，也需要设置为不生效
            DutyPlan.objects.filter(
                duty_rule_id__in=disabled_duty_rules, user_group_id=self.user_group.id, is_effective=1
            ).update(is_effective=0)

        # 排除掉没有发生变化的，其他的都需要重新生效
        new_group_rule_snaps = [
            snap_object for key, snap_object in new_duty_snaps.items() if key not in no_changed_duties
        ]
        expired_snaps = []
        updated_rule_snaps = []
        # 如果有快照已经修改过，需要更改或删除原有的的的快照
        for duty_rule_snap in changed_duties:
            # 已有的duty snaps
            current_duty_rule = new_duty_snaps[f'{self.user_group.id}--{duty_rule_snap.duty_rule_id}']

            if duty_rule_snap.next_plan_time >= current_duty_rule.next_plan_time:
                # 如果原来的下一次安排时间晚于当前的生效时间，说明原有的将会过期
                expired_snaps.append(duty_rule_snap.id)
            else:
                # 如果原有的快照晚于当前的安排时间， 则设置最新快照的首次安排时间为当前的结束时间
                duty_rule_snap.end_time = current_duty_rule.next_plan_time
                updated_rule_snaps.append(duty_rule_snap)

        # step1 先创建一波新的snap
        if new_group_rule_snaps:
            DutyRuleSnap.objects.bulk_create(new_group_rule_snaps)

        # step2 然后再来一波更新
        if updated_rule_snaps:
            DutyRuleSnap.objects.bulk_update(updated_rule_snaps, fields=['next_plan_time'])

        # step 3 删除掉过期的
        if expired_snaps:
            DutyRuleSnap.objects.filter(id__in=expired_snaps).delete()

        # 排班的时候提前7天造好数据
        plan_time = time_tools.str2datetime(task_time) + timedelta(days=7)
        for rule_snap in DutyRuleSnap.objects.filter(
            next_plan_time__lte=time_tools.datetime2str(plan_time), user_group_id=self.user_group.id, enabled=True
        ):
            self.manage_duty_plan(rule_snap=rule_snap)

    def manage_duty_plan(self, rule_snap: DutyRuleSnap):
        # step 1 当前分组的原计划都设置为False
        if not rule_snap:
            logger.warning("[manage_duty_plan] snap of user group(%s) not existed", self.user_group.id)
            return

        snap_id = rule_snap.id
        logger.info("[manage_duty_plan] begin to manage duty(%s) plan for group(%s)", snap_id, self.user_group.id)

        # step 2 根据当前的轮值模式生成新的计划
        begin_time = rule_snap.next_plan_time

        duty_manager = DutyRuleManager(rule_snap.rule_snap, begin_time=begin_time)
        duty_plan_queryset = DutyPlan.objects.filter(
            duty_rule_id=rule_snap.duty_rule_id, user_group_id=self.user_group.id, is_effective=1
        )
        # 在指定日期之前生效的需要取消
        duty_plan_queryset.filter(Q(start_time__gte=begin_time)).update(is_effective=0)

        # 在开始时间之后还生效的部分，设置结束时间为开始时间
        duty_plan_queryset.filter(Q(finished_time__gt=begin_time) | Q(finished_time=None) | Q(finished_time="")).update(
            finished_time=begin_time
        )

        duty_plans = []
        for duty_plan in duty_manager.get_duty_plan():
            duty_end_times = [f'{work_time["end_time"]}:59' for work_time in duty_plan["work_times"]]
            duty_start_times = [f'{work_time["start_time"]}:00' for work_time in duty_plan["work_times"]]
            # 结束时间获取当前有效的排班时间最后一天即可
            finished_time = max(duty_end_times)
            # 开始时间取当前时间取当前排班内容里的最小一位
            start_time = min(duty_start_times)
            duty_plans.append(
                DutyPlan(
                    start_time=start_time,
                    finished_time=finished_time,
                    user_group_id=self.user_group.id,
                    duty_rule_id=rule_snap.duty_rule_id,
                    users=duty_plan["users"],
                    work_times=duty_plan["work_times"],
                    is_effective=1,
                    order=duty_plan.get("user_index", 0),
                )
            )

        # 创建排班计划
        DutyPlan.objects.bulk_create(duty_plans)

        # 更新对应的rule_snap的下一次管理计划任务时间
        rule_snap.next_plan_time = duty_manager.end_time
        rule_snap.next_user_index = duty_manager.last_user_index
        rule_snap.save(update_fields=["next_plan_time", "next_user_index", "rule_snap"])

        logger.info("[manage_duty_plan] finished for user group(%s) snap(%s)", self.user_group.id, snap_id)
