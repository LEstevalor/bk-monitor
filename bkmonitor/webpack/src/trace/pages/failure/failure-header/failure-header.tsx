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
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dialog, Form, Input, Popover, Progress, Tag } from 'bkui-vue';

import FailureEditDialog from './failure-edit-dialog';

import './failure-header.scss';

export default defineComponent({
  setup() {
    const { t } = useI18n();
    const isShow = ref<boolean>(false);
    const isShowResolve = ref<boolean>(false);
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
    const levelList = [
      {
        label: t('致命'),
        icon: 'danger',
        key: 'danger'
      },
      {
        label: t('预警'),
        icon: 'mind-fill',
        key: 'mind-fill'
      },
      {
        label: t('提醒'),
        icon: 'tips',
        key: 'tips'
      }
    ];
    const tagList = ['在线', '登录', '游戏', '异常', '时序'];
    const tipsItem = (val: number) => (
      <span class='tips-more'>
        ，其中 <b>{val}</b> 个未分派
        <span class='tips-btn'>
          <i class='icon-monitor icon-fenpai tips-btn-icon'></i>
          {t('告警分派')}
        </span>
      </span>
    );
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
    const renderFn = () => (
      <div class='failure-header'>
        <i class='icon-monitor icon-back-left head-icon'></i>
        <span class='header-sign'>
          <i class='icon-monitor icon-danger sign-icon'></i>
          {t('致命')}
        </span>
        <div class='header-info'>
          <span class='info-id'>14235345346534</span>
          <div class='info-name'>
            <label class='mr8'>故障名称占位</label>
            {tagList.map((item: any) => (
              <Tag>{item}</Tag>
            ))}
            <span
              class='info-edit'
              onClick={() => (isShow.value = true)}
            >
              <i class='icon-monitor icon-bianji info-edit-icon'></i>
              {t('编辑')}
            </span>
          </div>
        </div>
        <div class='header-status'>
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
          <span class='status-info'>
            <span class='txt'>未恢复</span>
            <span class='txt'>
              {t('故障持续时间：')}
              <b>00:08:23</b>
            </span>
          </span>
        </div>
        <div class='header-btn-group'>
          <div
            class='header-btn disabled'
            onClick={() => (isShowResolve.value = !isShowResolve.value)}
          >
            <i class='icon-monitor icon-mc-solved btn-icon'></i>
            {t('标记已解决')}
          </div>
          <div
            class='header-btn'
            onClick={() => {}}
          >
            <i class='icon-monitor icon-qiye-weixin btn-icon'></i>
            {t('故障群')}
          </div>
        </div>
        <FailureEditDialog
          visible={isShow.value}
          levelList={levelList}
          onChange={val => (isShow.value = val)}
        />
        {DialogFn()}
      </div>
    );
    return { renderFn };
  },
  render() {
    return this.renderFn();
  }
});
