/*
 * Tencent is pleased to support the open source community by making
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) available.
 *
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 *
 * 蓝鲸智云PaaS平台 (BlueKing PaaS) is licensed under the MIT License.
 *
 * License for 蓝鲸智云PaaS平台 (BlueKing PaaS):
 *
 * ---------------------------------------------------
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
 * to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of
 * the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
 * THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF
 * CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */
import { computed, defineComponent, inject, PropType, reactive, Ref, TransitionGroup, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Button, Input, Select } from 'bkui-vue';
import { random } from 'lodash';

import MemberSelect, { TagItemModel } from '../../../components/member-select/member-select';
import draggableIcon from '../../../static/img/draggable.svg';
import { RotationSelectTypeEnum } from '../typings/common';
import { randomColor } from '../utils';

import CalendarSelect from './calendar-select';
import DataTimeSelect from './data-time-select';
import FormItem from './form-item';
import TimeTagPicker from './time-tag-picker';
import WeekSelect from './week-select';

import './replace-rotation-tab.scss';

type CustomTabType = 'duration' | 'classes';
type WorkTimeType = 'time_range' | 'datetime_range';
export interface ReplaceRotationDateModel {
  key: number;
  workDays?: number[];
  workTime: string[][];
  periodSettings?: { unit: 'hour' | 'day'; duration: number };
}
export interface ReplaceRotationUsersModel {
  type: 'specified' | 'auto';
  groupNumber?: number;
  value: { key: number; value: { type: 'group' | 'user'; id: string }[] }[];
}

export interface ReplaceDataModel {
  id?: number;
  date: {
    type: RotationSelectTypeEnum;
    workTimeType?: WorkTimeType;
    isCustom: boolean;
    customTab?: CustomTabType;
    customWorkDays?: number[];
    value: ReplaceRotationDateModel[];
  };
  users: ReplaceRotationUsersModel;
}

export default defineComponent({
  name: 'ReplaceRotationTab',
  props: {
    data: {
      type: Object as PropType<ReplaceDataModel>,
      default: undefined
    }
  },
  emits: ['change'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const defaultGroup = inject<Ref<any[]>>('defaultGroup');

    const rotationTypeList: { label: string; value: RotationSelectTypeEnum }[] = [
      { label: t('工作日(周一至周五)'), value: RotationSelectTypeEnum.WorkDay },
      { label: t('周末(周六、周日)'), value: RotationSelectTypeEnum.Weekend },
      { label: t('每天'), value: RotationSelectTypeEnum.Daily },
      { label: t('每周'), value: RotationSelectTypeEnum.Weekly },
      { label: t('每月'), value: RotationSelectTypeEnum.Monthly },
      { label: t('自定义'), value: RotationSelectTypeEnum.Custom }
    ];

    const localValue = reactive<ReplaceDataModel>({
      id: undefined,
      date: {
        type: RotationSelectTypeEnum.WorkDay,
        workTimeType: 'time_range',
        isCustom: false,
        customTab: 'duration',
        customWorkDays: [],
        value: [createDefaultDate()]
      },
      users: {
        type: 'specified',
        groupNumber: 1,
        value: [{ key: random(8, true), value: [] }]
      }
    });

    /** 轮值类型 */
    const rotationSelectType = computed({
      get() {
        return localValue.date.isCustom ? RotationSelectTypeEnum.Custom : localValue.date.type;
      },
      set(val: RotationSelectTypeEnum) {
        localValue.date.workTimeType = 'time_range';
        localValue.date.customTab = 'duration';
        if (val === RotationSelectTypeEnum.Custom) {
          localValue.date.isCustom = true;
          localValue.date.type = RotationSelectTypeEnum.Weekly;
        } else {
          localValue.date.isCustom = false;
          localValue.date.type = val;
        }
        localValue.date.value = [createDefaultDate()];
      }
    });

    watch(
      () => props.data,
      val => {
        if (val) {
          Object.assign(localValue, val);
        }
      },
      {
        immediate: true
      }
    );

    function createDefaultDate(): ReplaceRotationDateModel {
      return {
        key: random(8, true),
        workTime: [],
        workDays: [],
        periodSettings: { unit: 'hour', duration: 1 }
      };
    }

    /**
     * 新增/删除单班时间项
     */
    function handleClassesItemChange(type: 'add' | 'del', ind = 1) {
      if (type === 'add') {
        localValue.date.value.push(createDefaultDate());
      } else {
        localValue.date.value.splice(ind, 1);
        handleEmitData();
      }
    }

    /**
     * 轮值类型为每周和每月时渲染的内容
     * @param rotationType 轮值类型
     * @returns 渲染的内容
     */
    function weekAndMonthClasses(rotationType: RotationSelectTypeEnum.Weekly | RotationSelectTypeEnum.Monthly) {
      const val = localValue.date.value;

      /**
       * 时间范围和起止时间类型切换
       * @param type 切换的类型
       */
      function handleDateTypeChange(type: WorkTimeType) {
        localValue.date.workTimeType = type;
        localValue.date.value = [createDefaultDate()];
      }

      /**
       * 渲染时间范围类型的单班时间项
       * @param item 数据
       * @param ind 索引
       */
      function renderTimeRangeItem(item: ReplaceRotationDateModel, ind: number) {
        return [
          rotationType === RotationSelectTypeEnum.Weekly ? (
            <WeekSelect
              class='mr8'
              v-model={item.workDays}
              label={val.length > 1 ? t('第 {num} 班', { num: ind + 1 }) : ''}
              onSelectEnd={handleEmitData}
            />
          ) : (
            <CalendarSelect
              class='mr8'
              hasStart
              v-model={item.workDays}
              label={val.length > 1 ? t('第 {num} 班', { num: ind + 1 }) : ''}
              onSelectEnd={handleEmitData}
            />
          ),
          <TimeTagPicker
            v-model={item.workTime}
            onChange={handleEmitData}
          />,
          val.length > 1 && (
            <i
              class='icon-monitor icon-mc-delete-line del-icon'
              onClick={() => handleClassesItemChange('del', ind)}
            />
          )
        ];
      }
      function dataTimeSelectChange(val: string[], item: ReplaceRotationDateModel, type: 'start' | 'end') {
        if (type === 'start') {
          item.workTime[0] = val;
        } else {
          item.workTime[1] = val;
        }
      }
      /**
       * 渲染起止时间类型的单班时间项
       * @param item 数据
       * @param ind 索引
       */
      function renderDateTimeRangeItem(item: ReplaceRotationDateModel, ind: number) {
        return [
          <DataTimeSelect
            modelValue={item.workTime[0]}
            label={val.length > 1 ? t('第 {num} 班', { num: ind + 1 }) : ''}
            type={rotationType === RotationSelectTypeEnum.Weekly ? 'week' : 'calendar'}
            onChange={val => dataTimeSelectChange(val, item, 'start')}
          />,
          <span class='separator-to'>{t('至')}</span>,
          <DataTimeSelect
            modelValue={item.workTime[1]}
            type={rotationType === RotationSelectTypeEnum.Weekly ? 'week' : 'calendar'}
            onChange={val => dataTimeSelectChange(val, item, 'end')}
          />,
          val.length > 1 && (
            <i
              class='icon-monitor icon-mc-delete-line del-icon'
              onClick={() => handleClassesItemChange('del', ind)}
            />
          )
        ];
      }

      return [
        <FormItem
          label=''
          labelWidth={70}
        >
          <div class='tab-list'>
            <div
              class={['tab-list-item', localValue.date.workTimeType === 'time_range' && 'active']}
              onClick={() => handleDateTypeChange('time_range')}
            >
              {t('时间范围')}
            </div>
            <div
              class={['tab-list-item', localValue.date.workTimeType === 'datetime_range' && 'active']}
              onClick={() => handleDateTypeChange('datetime_range')}
            >
              {t('起止时间')}
            </div>
          </div>
        </FormItem>,
        <FormItem
          label={t('单班时间')}
          labelWidth={70}
        >
          <div class='classes-list'>
            {val.map((item, ind) => (
              <div
                class='classes-item'
                key={item.key}
              >
                {localValue.date.workTimeType === 'time_range'
                  ? renderTimeRangeItem(item, ind)
                  : renderDateTimeRangeItem(item, ind)}
              </div>
            ))}
            <Button
              class='add-btn'
              theme='primary'
              text
              onClick={() => handleClassesItemChange('add')}
            >
              <i class='icon-monitor icon-plus-line add-icon'></i>
              {t('新增值班')}
            </Button>
          </div>
        </FormItem>
      ];
    }
    /**
     * 轮值类型为自定义时渲染的内容
     * @param rotationType 轮值类型
     * @returns 渲染的内容
     */
    function customClasses() {
      const { value } = localValue.date;
      function handleTypeChange(type: CustomTabType) {
        localValue.date.customTab = type;
        type === 'duration' && (localValue.date.value = [value[0]]);
      }
      function handleDateTypeChange() {
        localValue.date.customWorkDays = [];
        handleEmitData();
      }

      return [
        <FormItem
          label={t('有效日期')}
          labelWidth={70}
          class='expiration-date-form-item'
        >
          <Select
            v-model={localValue.date.type}
            class='date-type-select'
            onChange={handleDateTypeChange}
            clearable={false}
          >
            <Select.Option
              label={t('按周')}
              value={RotationSelectTypeEnum.Weekly}
            />
            <Select.Option
              label={t('按月')}
              value={RotationSelectTypeEnum.Monthly}
            />
          </Select>
          {localValue.date.type === RotationSelectTypeEnum.Weekly && (
            <WeekSelect
              v-model={localValue.date.customWorkDays}
              onSelectEnd={handleEmitData}
            />
          )}
          {localValue.date.type === RotationSelectTypeEnum.Monthly && (
            <CalendarSelect
              class='date-value-select'
              v-model={localValue.date.customWorkDays}
              onSelectEnd={handleEmitData}
            />
          )}
        </FormItem>,
        <FormItem
          label=''
          labelWidth={70}
        >
          <div class='tab-list'>
            <div
              class={['tab-list-item', localValue.date.customTab === 'duration' && 'active']}
              onClick={() => handleTypeChange('duration')}
            >
              {t('指定时长')}
            </div>
            <div
              class={['tab-list-item', localValue.date.customTab === 'classes' && 'active']}
              onClick={() => handleTypeChange('classes')}
            >
              {t('指定班次')}
            </div>
          </div>
        </FormItem>,
        <FormItem
          label={localValue.date.customTab === 'duration' ? t('有效时间') : t('单班时间')}
          labelWidth={70}
        >
          <div class='classes-list'>
            {value.map((item, ind) => (
              <div
                class='classes-item'
                key={item.key}
              >
                <TimeTagPicker
                  v-model={item.workTime}
                  label={value.length > 1 ? t('第 {num} 班', { num: ind + 1 }) : ''}
                  onChange={handleEmitData}
                />
                {value.length > 1 && (
                  <i
                    class='icon-monitor icon-mc-delete-line del-icon'
                    onClick={() => handleClassesItemChange('del', ind)}
                  />
                )}
              </div>
            ))}
            {localValue.date.customTab === 'classes' && (
              <Button
                class='add-btn'
                theme='primary'
                text
                onClick={() => handleClassesItemChange('add')}
              >
                <i class='icon-monitor icon-plus-line add-icon'></i>
                {t('新增值班')}
              </Button>
            )}
          </div>
        </FormItem>,
        localValue.date.customTab === 'duration' && (
          <FormItem
            label={t('单班时长')}
            labelWidth={70}
            class='classes-duration-form-item'
          >
            <Input
              v-model={value[0].periodSettings.duration}
              type='number'
              min={1}
              onblur={handleEmitData}
            />
            <Select
              v-model={value[0].periodSettings.unit}
              clearable={false}
              onChange={handleEmitData}
            >
              <Select.Option
                label={t('小时')}
                value='hour'
              />
              <Select.Option
                label={t('天')}
                value='day'
              />
            </Select>
          </FormItem>
        )
      ];
    }
    /**
     * 渲染不同轮值类型下的单班时间
     */
    function renderClassesContent() {
      switch (rotationSelectType.value) {
        /** 工作日 */
        case RotationSelectTypeEnum.WorkDay:
        /** 周末 */
        case RotationSelectTypeEnum.Weekend:
        /** 每天 */
        case RotationSelectTypeEnum.Daily: {
          const val = localValue.date.value;
          return (
            <FormItem
              label={t('单班时间')}
              labelWidth={70}
            >
              <div class='classes-list'>
                {val.map((item, ind) => (
                  <div class='classes-item'>
                    <TimeTagPicker
                      key={item.key}
                      v-model={item.workTime}
                      label={val.length > 1 ? t('第 {num} 班', { num: ind + 1 }) : ''}
                      onChange={handleEmitData}
                    />
                    {val.length > 1 && (
                      <i
                        class='icon-monitor icon-mc-delete-line del-icon'
                        onClick={() => handleClassesItemChange('del', ind)}
                      />
                    )}
                  </div>
                ))}
                <Button
                  class='add-btn'
                  theme='primary'
                  text
                  onClick={() => handleClassesItemChange('add')}
                >
                  <i class='icon-monitor icon-plus-line add-icon' />
                  {t('新增值班')}
                </Button>
              </div>
            </FormItem>
          );
        }
        /** 每周 */
        case RotationSelectTypeEnum.Weekly:
        /** 每月 */
        case RotationSelectTypeEnum.Monthly:
          return weekAndMonthClasses(rotationSelectType.value);
        /** 自定义 */
        case RotationSelectTypeEnum.Custom:
          return customClasses();
      }
    }

    // ---------用户组----------
    /** 切换分组类型 */
    function handleGroupTabChange(val: ReplaceRotationUsersModel['type']) {
      if (localValue.users.type === val) return;
      localValue.users.type = val;
      // 切换成自动分组需要把所有的用户组删除
      if (val === 'auto') {
        const res = localValue.users.value.reduce((pre, cur) => {
          cur.value.forEach(user => {
            const key = `${user.id}_${user.type}`;
            if (!pre.has(key) && user.type === 'user') {
              pre.set(key, user);
            }
          });
          return pre;
        }, new Map());
        localValue.users.value = [{ key: localValue.users.value[0].key, value: Array.from(res.values()) }];
      }
      handleEmitData();
    }

    function handleMemberSelectFilter(list: TagItemModel[]) {
      return list.filter(item => item.type === 'user');
    }
    function handleAddUserGroup() {
      localValue.users.value.push({ key: random(8, true), value: [] });
    }
    function handleDelUserGroup(ind: number) {
      localValue.users.value.splice(ind, 1);
      handleEmitData();
    }
    function handMemberSelectChange(ind: number, val: ReplaceRotationUsersModel['value'][0]['value']) {
      localValue.users.value[ind].value = val;
      handleEmitData();
    }

    function handleDragstart(e: DragEvent, index: number) {
      e.dataTransfer.setData('index', String(index));
    }
    function handleDragover(e: DragEvent) {
      e.preventDefault();
    }
    function handleDrop(e: DragEvent, index: number) {
      const startIndex = Number(e.dataTransfer.getData('index'));
      const user = localValue.users.value[startIndex];
      localValue.users.value.splice(startIndex, 1);
      localValue.users.value.splice(index, 0, user);
    }
    function handleEmitData() {
      emit('change', localValue);
    }

    return {
      t,
      defaultGroup,
      rotationTypeList,
      localValue,
      rotationSelectType,
      handleGroupTabChange,
      renderClassesContent,
      handleAddUserGroup,
      handleDelUserGroup,
      handMemberSelectChange,
      handleMemberSelectFilter,
      handleDragstart,
      handleDragover,
      handleDrop,
      handleEmitData
    };
  },
  render() {
    return (
      <table
        class='replace-table-wrap-content-component'
        cellspacing='0'
        cellpadding='0'
      >
        <tr class='table-header'>
          <th class='title-content'>
            <span class='step-text'>Step1:</span>
            <span class='step-title'>{this.t('设置轮值规则')}</span>
          </th>
          <th class='title-content'>
            <div class='flex step2'>
              <span class='step-text'>Step2:</span>
              <span class='step-title'>{this.t('添加用户')}</span>
              <div class='grouped-tab flex'>
                <div
                  class={['item', this.localValue.users.type === 'specified' && 'active']}
                  onClick={() => this.handleGroupTabChange('specified')}
                >
                  {this.t('手动分组')}
                </div>
                <div
                  class={['item', this.localValue.users.type === 'auto' && 'active']}
                  onClick={() => this.handleGroupTabChange('auto')}
                >
                  {this.t('自动分组')}
                </div>
              </div>
            </div>
          </th>
        </tr>
        <tr class='table-content'>
          <td class='step-wrapper'>
            <FormItem
              label={this.t('轮值类型')}
              labelWidth={70}
            >
              <Select
                v-model={this.rotationSelectType}
                clearable={false}
              >
                {this.rotationTypeList.map(item => (
                  <Select.Option
                    label={item.label}
                    value={item.value}
                  ></Select.Option>
                ))}
              </Select>
            </FormItem>

            {this.renderClassesContent()}
          </td>
          <td class='step-wrapper'>
            <div class='user-panel-wrap'>
              {this.localValue.users.type === 'specified' ? (
                // 手动分组
                <div class='specified-group-wrap'>
                  <TransitionGroup name={'flip-list'}>
                    {this.localValue.users.value.map((item, ind) => (
                      <div
                        class='specified-group-item'
                        key={item.key}
                        draggable
                        onDragstart={e => this.handleDragstart(e, ind)}
                        onDragover={e => this.handleDragover(e)}
                        onDrop={e => this.handleDrop(e, ind)}
                      >
                        <MemberSelect
                          showType='avatar'
                          v-model={item.value}
                          hasDefaultGroup={true}
                          defaultGroup={this.defaultGroup}
                          onChange={val => this.handMemberSelectChange(ind, val)}
                        >
                          {{
                            prefix: () => (
                              <div
                                class='member-select-prefix'
                                style={{ 'border-left-color': randomColor(ind) }}
                              >
                                <div class='draggable-icon-wrap'>
                                  <img
                                    class='icon'
                                    draggable={false}
                                    src={draggableIcon}
                                  />
                                </div>
                              </div>
                            )
                          }}
                        </MemberSelect>
                        {this.localValue.users.value.length > 1 && (
                          <i
                            class='icon-monitor icon-mc-delete-line del-icon'
                            onClick={() => this.handleDelUserGroup(ind)}
                          ></i>
                        )}
                      </div>
                    ))}
                  </TransitionGroup>
                  <Button
                    class='add-btn'
                    theme='primary'
                    text
                    onClick={this.handleAddUserGroup}
                  >
                    <i class='icon-monitor icon-plus-line add-icon' />
                    {this.t('添加用户组')}
                  </Button>
                </div>
              ) : (
                // 自动分组
                <div
                  class='auto-group-wrap'
                  v-show={this.localValue.users.type === 'auto'}
                >
                  <FormItem
                    label={this.t('轮值人员')}
                    labelWidth={70}
                  >
                    <MemberSelect
                      showType='tag'
                      filterMethod={this.handleMemberSelectFilter}
                      v-model={this.localValue.users.value[0].value}
                      hasDefaultGroup={true}
                      defaultGroup={this.defaultGroup}
                      onChange={val => this.handMemberSelectChange(0, val)}
                    />
                  </FormItem>
                  <FormItem
                    label={this.t('单次值班')}
                    labelWidth={70}
                  >
                    <Input
                      style='width: 200px'
                      v-model={this.localValue.users.groupNumber}
                      onChange={this.handleEmitData}
                      type='number'
                      suffix={this.t('人')}
                      min={1}
                    />
                  </FormItem>
                </div>
              )}
            </div>
          </td>
        </tr>
      </table>
    );
  }
});