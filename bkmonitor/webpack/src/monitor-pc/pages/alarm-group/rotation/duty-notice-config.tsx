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
import { Component, Emit, Prop, Watch } from 'vue-property-decorator';
import { Component as tsc } from 'vue-tsx-support';
import { Input, Option, Select, Switcher, TimePicker } from 'bk-magic-vue';

import SimpleDayPick from '../duty-arranges/simple-day-pick';

import { IDutyListItem } from './typing';

import './duty-notice-config.scss';

const typeList = [
  { label: window.i18n.t('按周'), value: 'week' },
  { label: window.i18n.t('按月'), value: 'month' }
];
const timeTypeList = [
  { label: window.i18n.t('周'), value: 'week' },
  { label: window.i18n.t('天'), value: 'day' }
];

const weekList = [
  { label: window.i18n.t('周一'), value: 1 },
  { label: window.i18n.t('周二'), value: 2 },
  { label: window.i18n.t('周三'), value: 3 },
  { label: window.i18n.t('周四'), value: 4 },
  { label: window.i18n.t('周五'), value: 5 },
  { label: window.i18n.t('周六'), value: 6 },
  { label: window.i18n.t('周日'), value: 7 }
];

/**
 * @description 默认表单数据
 * @returns
 */
export const initData = () => ({
  isSend: true,
  sendType: 'week',
  week: 1,
  month: 1,
  sendTime: '00:00',
  nearDay: 7,
  rtxId: '',
  needNotice: true,
  startNum: 1,
  timeType: 'week',
  rotationId: []
});

interface IProps {
  renderKey?: string;
  value?: any;
  dutyList?: IDutyListItem[];
  onChange?: (_v) => void;
}

@Component
export default class DutyNoticeConfig extends tsc<IProps> {
  @Prop({ default: '', type: String }) renderKey: string;
  @Prop({ default: () => initData(), type: Object }) value;
  @Prop({ default: () => [], type: Array }) dutyList: IDutyListItem[];

  formData = initData();

  /**
   * @description 初始化
   */
  created() {
    this.formData = { ...this.value };
  }

  /**
   * @description 更新数据
   */
  @Watch('renderKey')
  handleWatch() {
    this.formData = { ...this.value };
  }
  @Emit('change')
  handleChange() {
    return this.formData;
  }

  render() {
    function formItemBig(label: string | any, content: any, cls?: string) {
      return (
        <div class={['form-item-big', cls]}>
          <span class='form-item-label'>{label}</span>
          <span class='form-item-content'>{content}</span>
        </div>
      );
    }
    function formItem(label: string | any, content: any, cls?: string) {
      return (
        <div class={['form-item', cls]}>
          <span class='form-item-label'>{label}</span>
          <span class='form-item-content'>{content}</span>
        </div>
      );
    }
    return (
      <div class='rotation-config-duty-notice-config'>
        {formItemBig(
          this.$t('排班表发送'),
          <Switcher
            v-model={this.formData.isSend}
            size='small'
            theme='primary'
            onChange={() => this.handleChange()}
          ></Switcher>
        )}
        {formItem(
          this.$t('发送时间'),
          [
            <Select
              v-model={this.formData.sendType}
              clearable={false}
              class='mr-8'
              onChange={() => this.handleChange()}
            >
              {typeList.map(item => (
                <Option
                  key={item.value}
                  id={item.value}
                  name={item.label}
                ></Option>
              ))}
            </Select>,
            this.formData.sendType === 'week' ? (
              <Select
                v-model={this.formData.week}
                class='width-200 mr-8'
                clearable={false}
                onChange={() => this.handleChange()}
              >
                {weekList.map(item => (
                  <Option
                    key={item.value}
                    id={item.value}
                    name={item.label}
                  ></Option>
                ))}
              </Select>
            ) : (
              <SimpleDayPick
                multiple={false}
                class='width-200 mr-8'
                value={this.formData.month as any}
                onChange={v => {
                  this.formData.month = v as any;
                  this.handleChange();
                }}
              ></SimpleDayPick>
            ),
            <TimePicker
              class='width-200'
              v-model={this.formData.sendTime}
              format={'HH:mm'}
              onChange={() => this.handleChange()}
            ></TimePicker>
          ],
          'mt-16'
        )}
        {formItem(
          this.$t('发送内容'),
          [
            <Input
              v-model={this.formData.nearDay}
              class='width-148 mr-8'
              type='number'
              onChange={() => this.handleChange()}
            >
              <div
                slot='prepend'
                class='input-left'
              >
                {this.$t('近')}
              </div>
            </Input>,
            <span class='content-text'>{this.$t('天的排班结果')}</span>
          ],
          'mt-16'
        )}
        {formItem(
          this.$t('企业微信群ID'),
          [
            <Input
              class='mr-12'
              v-model={this.formData.rtxId}
              onChange={() => this.handleChange()}
            ></Input>,
            <span
              class='icon-monitor icon-tips'
              v-bk-tooltips={{
                content: this.$t(
                  "获取会话ID方法:<br/>1.群聊列表右键添加群机器人: {name}<br/>2.手动 @{name} 并输入关键字'会话ID'<br/>3.将获取到的会话ID粘贴到输入框，使用逗号分隔"
                ),
                boundary: 'window',
                placements: ['top']
              }}
            ></span>
          ],
          'mt-16'
        )}
        {formItemBig(
          this.$t('个人轮值通知'),
          <Switcher
            v-model={this.formData.needNotice}
            size='small'
            theme='primary'
            onChange={() => this.handleChange()}
          ></Switcher>,
          'mt-24'
        )}
        {formItem(
          this.$t('值班开始前'),
          [
            <Input
              v-model={this.formData.startNum}
              class='mr-8 width-168'
              type='number'
              onChange={() => this.handleChange()}
            >
              <div
                slot='append'
                class='input-right-select'
              >
                <Select
                  v-model={this.formData.timeType}
                  clearable={false}
                  onChange={() => this.handleChange()}
                >
                  {timeTypeList.map(item => (
                    <Option
                      key={item.value}
                      id={item.value}
                      name={item.label}
                    ></Option>
                  ))}
                </Select>
              </div>
            </Input>,
            <span class='content-text'>{this.$t('收到通知')}</span>
          ],
          'mt-16'
        )}
        {formItem(
          this.$t('指定轮值规则'),
          <Select
            class='width-305'
            v-model={this.formData.rotationId}
            multiple
            clearable={false}
            searchable
            onChange={() => this.handleChange()}
          >
            {this.dutyList.map(item => (
              <Option
                id={item.id}
                key={item.id}
                name={item.name}
              >
                <span>{item.name}</span>
                <span
                  style={{
                    'margin-left': '8px',
                    color: '#c4c6cc'
                  }}
                >
                  {item.category === 'regular' ? this.$t('固定值班') : this.$t('交替轮值')}
                </span>
              </Option>
            ))}
          </Select>,
          'mt-16'
        )}
      </div>
    );
  }
}
