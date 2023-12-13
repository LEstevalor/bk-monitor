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

import { computed, defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, Form, Input, Popover, Progress, Tag } from 'bkui-vue';

import FailureEditDialog from './failure-edit-dialog';

import './failure-header.scss';

export default defineComponent({
  name: 'FailureHeader',
  props: {
    incidentDetail: {
      type: Object,
      default: () => {}
    }
  },
  setup(props) {
    const { t } = useI18n();
    const isShow = ref<boolean>(false);
    const isShowResolve = ref<boolean>(false);
    // const incidentDetail = inject('incidentDetail');
    const tipsData = [
      {
        name: t('未恢复'),
        total: 120,
        percent: '75%'
      },
      {
        name: t('已恢复'),
        total: 20,
        percent: '7%'
      },
      {
        name: t('已失效'),
        total: 20,
        percent: '7%'
      }
    ];
    const levelList = {
      /** 致命 */
      ERROR: {
        label: t('致命'),
        key: 'danger',
        name: 'ERROR'
      },
      /** 告警 */
      WARN: {
        label: t('预警'),
        key: 'mind-fill',
        name: 'WARN'
      },
      /** 提醒 */
      INFO: {
        label: t('提醒'),
        key: 'tips',
        name: 'INFO'
      }
    };
    const statusList = {
      /** 已恢复  */
      recovered: {
        icon: 'mc-check-fill',
        color: '#1CAB88'
      },
      /** 观察中  */
      recovering: {
        icon: 'guanchazhong',
        color: '#FF9C01'
      },
      /** 已解决  */
      closed: {
        icon: 'mc-solved',
        color: '#979BA5'
      }
    };
    const tipsItem = (val: number) => (
      <span class='tips-more'>
        ，其中 <b>{val}</b> 个未分派
        <span class='tips-btn'>
          <i class='icon-monitor icon-fenpai tips-btn-icon'></i>
          {t('告警分派')}
        </span>
      </span>
    );
    const incidentDetailData = computed(() => {
      return props.incidentDetail;
    });
    const statusTips = () => (
      <div class='header-status-tips'>
        <div class='tips-head'>
          故障内的告警：共
          <b> 160 </b> 个
        </div>
        {tipsData.map((item: any, ind: number) => (
          <span class={['tips-item', { marked: ind === 0 }]}>
            {item.name}：<b>{item.total}</b> (<b>{item.percent}</b>){ind === 0 && tipsItem(10)}
          </span>
        ))}
      </div>
    );
    const renderStatusIcon = (status: string) => {
      // 未恢复
      if (status === 'abnormal') {
        return (
          <Popover
            placement='bottom-start'
            theme='light'
            width='350'
            v-slots={{
              content: () => {
                return statusTips();
              }
            }}
          >
            <Progress
              text-inside
              type='circle'
              width={38}
              percent={78}
              stroke-width={12}
              bg-color='#EBECF0'
              color='#EB3333'
            >
              <label class='status-num'>120</label>
            </Progress>
          </Popover>
        );
      }
      const info = statusList[status];
      return (
        <i
          class={`icon-monitor icon-${info?.icon} status-icon`}
          style={{ color: info?.color }}
        />
      );
    };
    /** 标记已解决弹框 */
    const DialogFn = () => (
      <Dialog
        ext-cls='failure-edit-dialog'
        is-show={isShowResolve.value}
        title={t('标记已解决')}
        dialog-type='operation'
      >
        <Form form-type={'vertical'}>
          <Form.FormItem
            label={t('故障原因')}
            required
          >
            <Input
              type='textarea'
              maxlength={300}
            />
          </Form.FormItem>
        </Form>
      </Dialog>
    );
    return { DialogFn, incidentDetailData, isShow, levelList, t, statusTips, isShowResolve, renderStatusIcon };
  },
  render() {
    const { id, incident_name, labels, status_alias, level, level_alias, status } = this.incidentDetailData;
    const isRecovered = status !== 'recovered';
    return (
      <div class='failure-header'>
        <i class='icon-monitor icon-back-left head-icon'></i>
        <span class={`header-sign ${this.levelList[level]?.key}`}>
          <i class={`icon-monitor icon-${this.levelList[level]?.key} sign-icon`}></i>
          {level_alias}
        </span>
        <div class='header-info'>
          <span class='info-id'>{id}</span>
          <div class='info-name'>
            <label
              class='info-name-title mr8'
              title={incident_name}
            >
              {incident_name}
            </label>
            {(labels || []).map((item: any) => (
              <Tag>{item}</Tag>
            ))}
            <span
              class='info-edit'
              onClick={() => (this.isShow = true)}
            >
              <i class='icon-monitor icon-bianji info-edit-icon'></i>
              {this.t('编辑')}
            </span>
          </div>
        </div>
        <div class='header-status'>
          <div class='header-status-icon'>{this.renderStatusIcon(status)}</div>
          <span class='status-info'>
            <span class='txt'>{status_alias}</span>
            <span class='txt'>
              {this.t('故障持续时间：')}
              <b>00:08:23</b>
            </span>
          </span>
        </div>
        <div class='header-btn-group'>
          <div
            class={['header-btn', { disabled: isRecovered }]}
            onClick={() => (this.isShowResolve = !this.isShowResolve)}
            v-bk-tooltips={{
              content: this.t('故障已恢复，才可以标记已解决'),
              disabled: !isRecovered
            }}
          >
            <i class='icon-monitor icon-mc-solved btn-icon'></i>
            {this.t('标记已解决')}
          </div>
          <div
            class='header-btn'
            onClick={() => {}}
          >
            <i class='icon-monitor icon-qiye-weixin btn-icon'></i>
            {this.t('故障群')}
          </div>
        </div>
        <FailureEditDialog
          visible={this.isShow}
          levelList={this.levelList}
          data={this.incidentDetailData}
          onChange={val => (this.isShow = val)}
        />
        {this.DialogFn()}
      </div>
    );
  }
});
