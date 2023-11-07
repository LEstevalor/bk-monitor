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
import { Button, Sideslider } from 'bk-magic-vue';

import { mockRequest } from '../../../../trace/pages/rotation/mockData';
import {
  RotationSelectTextMap,
  RotationSelectTypeEnum,
  RotationTabTypeEnum
} from '../../../../trace/pages/rotation/typings/common';
import { randomColor, transformDetailTimer, transformDetailUsers } from '../../../../trace/pages/rotation/utils';
import HistoryDialog from '../../../components/history-dialog/history-dialog';

import RotationCalendarPreview from './rotation-calendar-preview';

import './rotation-detail.scss';

interface IProps {
  show: boolean;
  onShowChange?: (v: boolean) => void;
}

@Component
export default class RotationDetail extends tsc<IProps> {
  @Prop({ type: Boolean, default: false }) show: boolean;

  detailData = null;
  type: RotationTabTypeEnum = RotationTabTypeEnum.REGULAR;
  rotationType: RotationSelectTypeEnum = RotationSelectTypeEnum.Weekly;
  users = [];
  timeList = [];

  loading = false;

  get historyList() {
    return [
      { label: this.$t('创建人'), value: this.detailData?.createUser || '--' },
      { label: this.$t('创建时间'), value: this.detailData?.createTime || '--' },
      { label: this.$t('最近更新人'), value: this.detailData?.updateUser || '--' },
      { label: this.$t('修改时间'), value: this.detailData?.updateTime || '--' }
    ];
  }

  @Watch('show')
  handleShow(v: boolean) {
    if (v) {
      this.getData();
    }
  }

  @Emit('showChange')
  emitIsShow(val: boolean) {
    return val;
  }

  getData() {
    this.loading = true;
    mockRequest('replace')
      .then((res: any) => {
        this.detailData = res;
        this.type = res.category;
        this.rotationType = res.duty_arranges?.[0]?.duty_time?.[0].work_type || RotationSelectTypeEnum.Weekly;
        this.users = transformDetailUsers(this.detailData.duty_arranges, this.type);
        this.timeList = transformDetailTimer(this.detailData.duty_arranges, this.type);
      })
      .finally(() => {
        this.loading = false;
      });
  }

  handleToEdit() {
    const url = `${location.origin}${location.pathname}?bizId=${this.$store.getters.bizId}#/trace/rotation-edit/${this.detailData.id}`;
    window.open(url);
  }

  renderUserLogo(user) {
    if (user.logo) return <img src={user.logo}></img>;
    if (user.type === 'group') return <span class='icon-monitor icon-mc-user-group no-img'></span>;
    return <span class='icon-monitor icon-mc-user-one no-img'></span>;
  }

  render() {
    function formItem(label, content) {
      return (
        <div class='form-item'>
          <div class='form-item-label'>{label} : </div>
          <div class='form-item-content'>{content}</div>
        </div>
      );
    }
    return (
      <Sideslider
        ext-cls='alarm-group-rotation-detail-side'
        {...{ on: { 'update:isShow': this.emitIsShow } }}
        width={960}
        quick-close={true}
        is-show={this.show}
      >
        <div
          class='rotation-detail-side-header'
          slot='header'
        >
          <span class='header-left'>{this.$t('轮值详情')}</span>
          <span class='header-right'>
            <Button
              class='mr-8'
              theme='primary'
              outline
              onClick={() => this.handleToEdit()}
            >
              {this.$t('编辑')}
            </Button>
            <HistoryDialog
              style='margin: 0 0 0 8px'
              list={this.historyList}
            ></HistoryDialog>
          </span>
        </div>
        <div
          slot='content'
          class='rotation-detail-side-content'
        >
          {formItem(this.$t('规则名称'), <span class='detail-text'>{this.detailData?.name || '--'}</span>)}
          {formItem(this.$t('标签'), <span class='detail-text'>{this.detailData?.labels?.join(', ') || '--'}</span>)}
          {formItem(
            this.$t('轮值类型'),
            <span class='detail-text'>
              {this.type === RotationTabTypeEnum.REGULAR ? this.$t('日常轮班') : this.$t('交替轮值')}
            </span>
          )}
          {this.type === RotationTabTypeEnum.REGULAR
            ? [
                formItem(
                  this.$t('值班人员'),
                  <span class='notice-user'>
                    {this.users.map(user => (
                      <div class='personnel-choice'>
                        {this.renderUserLogo(user)}
                        <span>{user.display_name}</span>
                      </div>
                    ))}
                  </span>
                ),
                formItem(
                  this.$t('工作时间范围'),
                  <div class='regular-form-item-wrap'>
                    {this.timeList.map(item => (
                      <span class='detail-text'>{item.dateRange}</span>
                    ))}
                  </div>
                ),
                formItem(
                  this.$t('工作时间'),
                  <div class='regular-form-item-wrap'>
                    {this.timeList.map(item => (
                      <span class='detail-text'>{item.time}</span>
                    ))}
                  </div>
                )
              ]
            : [
                formItem(
                  this.$t('值班用户组'),
                  <div class='notice-user-list'>
                    {this.users.map((item, ind) => (
                      <span class='notice-user pl-16'>
                        <div
                          class='has-color'
                          style={{ background: randomColor(ind) }}
                        ></div>
                        {item.map(user => (
                          <div class='personnel-choice'>
                            {this.renderUserLogo(user)}
                            <span>{user.display_name}</span>
                          </div>
                        ))}
                      </span>
                    ))}
                  </div>
                ),
                formItem(
                  this.$t('轮值类型'),
                  <span class='detail-text'>{RotationSelectTextMap[this.rotationType]}</span>
                ),
                formItem(
                  this.$t('单班时间'),
                  this.timeList.map(time => <div class='muti-text'>{time}</div>)
                )
              ]}
          {formItem(
            this.$t('生效时间'),
            <span class='detail-text'>{`${this.detailData?.effective_time} - ${
              this.detailData?.end_time || this.$t('永久')
            }`}</span>
          )}
          {formItem(this.$t('轮值预览'), <RotationCalendarPreview></RotationCalendarPreview>)}
        </div>
      </Sideslider>
    );
  }
}