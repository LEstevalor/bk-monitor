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

import { computed, defineComponent, inject, onMounted, ref, onBeforeUnmount, inject, Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { Dialog, Form, Input, Loading, Popover, Progress, Tag } from 'bkui-vue';

import { incidentAlertAggregate } from '../../../../monitor-api/modules/incident';

import FailureEditDialog from './failure-edit-dialog';
import './failure-header.scss';

export default defineComponent({
  name: 'FailureHeader',
  setup() {
    const { t } = useI18n();
    const isShow = ref<boolean>(false);
    const isShowResolve = ref<boolean>(false);
    const router = useRouter();
    const listLoading = ref(false);
    const alertAggregateData = ref([]);
    const alertAggregateTotal = ref(0);
    const showTime = ref('00:00:00');
    const timer = ref(null);
    const incidentDetail = inject<Ref<object>>('incidentDetail');
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
    const getIncidentAlertAggregate = () => {
      listLoading.value = true;
      incidentAlertAggregate({
        bk_biz_id: 2,
        id: 17024603108,
        aggregate_bys: []
      })
        .then(res => {
          alertAggregateData.value = res;
          alertAggregateTotal.value = Object.values(res || {}).reduce((prev, cur) => {
            return prev + cur?.count;
          }, 0);
        })
        .catch(err => {
          console.log(err);
        })
        .finally(() => (listLoading.value = false));
    };
    const handleBack = () => {
      router.go(-1);
    };
    /** 一期先不展示 */
    // const tipsItem = (val: number) => (
    //   <span class='tips-more'>
    //     ，其中 <b>{val}</b> 个未分派
    //     <span class='tips-btn'>
    //       <i class='icon-monitor icon-fenpai tips-btn-icon'></i>
    //       {t('告警分派')}
    //     </span>
    //   </span>
    // );
    const incidentDetailData = computed(() => {
      return incidentDetail.value;
    });
    const statusTips = () => {
      const list = Object.values(alertAggregateData.value);
      const total = alertAggregateTotal.value;
      return (
        <div class='header-status-tips'>
          <div class='tips-head'>
            {t('故障内的告警：共')}
            <b> {total} </b> 个
          </div>
          {list.map((item: any, ind: number) => (
            <span class={['tips-item', { marked: ind === 0 }]}>
              {item.name}：<b>{item.count}</b> (<b>{Math.round((item.count / total) * 100)}%</b>)
              {/* {ind === 0 && tipsItem(10)} */}
            </span>
          ))}
        </div>
      );
    };
    const renderStatusIcon = (status = 'closed') => {
      // 未恢复
      if (status === 'abnormal') {
        const data = alertAggregateData.value?.ABNORMAL || {};
        return (
          <Popover
            placement='bottom-start'
            theme='light'
            width='200'
            // width='350'
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
              percent={Math.round((data?.count / alertAggregateTotal.value) * 100)}
              stroke-width={12}
              bg-color='#EBECF0'
              color='#EB3333'
            >
              <label class='status-num'>{data?.count}</label>
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
    const formatDuration = (timestamp1, timestamp2) => {
      // 计算两个时间戳之间的差值（以毫秒为单位）
      const diff = Math.abs(timestamp1 - timestamp2);
      // 将差值转换为几时几分几秒的格式
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const padZeros = (str: number) => `${str > 10 ? str : `0${str}`}`;
      // 返回格式化后的字符串
      return `${padZeros(hours)}:${padZeros(minutes)}:${padZeros(seconds)}`;
    };
    onMounted(() => {
      getIncidentAlertAggregate();
    });
    onBeforeUnmount(() => {
      clearInterval(timer);
    });
    return {
      DialogFn,
      incidentDetailData,
      isShow,
      levelList,
      t,
      statusTips,
      isShowResolve,
      renderStatusIcon,
      handleBack,
      listLoading,
      formatDuration,
      showTime,
      timer
    };
  },
  render() {
    const { id, incident_name, labels, status_alias, level, level_alias, status, begin_time, end_time } = this.incidentDetailData;
    const isRecovered = status !== 'recovered';
    /** 持续时间 */
    const handleShowTime = () => {
      if (!begin_time) {
        return '00:00:00';
      }
      if (!end_time) {
        this.showTime = this.formatDuration(begin_time * 1000, new Date().getTime());
        this.timer = setInterval(() => {
          !!begin_time && (this.showTime = this.formatDuration(begin_time * 1000, new Date().getTime()));
        }, 1000);
        return this.showTime;
      }
      return this.formatDuration(begin_time * 1000, end_time * 1000);
    };
    return (
      <Loading loading={this.listLoading}>
        <div class='failure-header'>
          <i
            class='icon-monitor icon-back-left head-icon'
            onClick={this.handleBack}
          ></i>
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
                <b>{handleShowTime()}</b>
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
      </Loading>
    );
  }
});
