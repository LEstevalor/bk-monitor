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
import { defineComponent, onBeforeMount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Loading, Popover, Table } from 'bkui-vue';
import { $bkPopover } from 'bkui-vue/lib/popover';
import moment from 'moment';

import { feedbackIncidentRoot, incidentAlertList } from '../../../../monitor-api/modules/incident';
import { random } from '../../../../monitor-common/utils/utils.js';
import SetMealAdd from '../../../store/modules/set-meal-add';
import StatusTag from '../components/status-tag';
import FeedbackCauseDialog from '../failure-topo/feedback-cause-dialog';
import { useIncidentInject } from '../utils';

import ChatGroup from './chat-group/chat-group';
import AlarmConfirm from './alarm-confirm';
import AlarmDispatch from './alarm-dispatch';
import Collapse from './collapse';
import ManualProcess from './manual-process';
import QuickShield from './quick-shield';

import './alarm-detail.scss';

export enum EBatchAction {
  quickShield = 'shield',
  alarmConfirm = 'ack',
  alarmDispatch = 'dispatch'
}
export default defineComponent({
  props: {
    incidentDetail: {
      type: Object,
      default: () => {}
    }
  },
  setup() {
    const { t } = useI18n();
    const setMealAddModule = SetMealAdd();
    onBeforeMount(async () => await setMealAddModule.getVariableDataList());
    const scrollLoading = ref(false);
    const incidentId = useIncidentInject();
    const tableLoading = ref(false);
    const queryString = ref('');
    const tableData = ref([]);
    const alertData = ref([]);
    const dialog = reactive({
      quickShield: {
        show: false,
        details: [
          {
            severity: 1,
            dimension: '',
            trigger: '',
            strategy: {
              id: '',
              name: ''
            }
          }
        ],
        ids: [],
        bizIds: []
      },
      alarmConfirm: {
        show: false,
        ids: [],
        bizIds: []
      },
      rootCauseConfirm: {
        show: false,
        ids: [],
        data: {},
        bizIds: []
      },
      alarmDispatch: {
        show: false,
        bizIds: [],
        alertIds: []
      },
      manualProcess: {
        show: false,
        alertIds: [],
        bizIds: [],
        debugKey: random(8),
        actionIds: [],
        mealInfo: null
      }
    });
    /** 一键拉群弹窗 */
    const chatGroupDialog = reactive({
      show: false,
      alertName: '',
      bizId: [],
      assignee: [],
      alertIds: []
    });
    const collapseId = ref(null);
    const moreItems = ref(null);
    const popoperOperateInstance = ref(null);
    const opetateRow = ref({});
    const popoperOperateIndex = ref(-1);
    const hoverRowIndex = ref(999999);
    const tableToolList = ref([]);
    const enableCreateChatGroup = ref((window as any).enable_create_chat_group || false);
    if (enableCreateChatGroup.value) {
      tableToolList.value.push({
        id: 'chat',
        name: t('一键拉群')
      });
    }
    const formatterTime = (time: number | string): string => {
      if (!time) return '--';
      if (typeof time !== 'number') return time;
      if (time.toString().length < 13) return moment(time * 1000).format('YYYY-MM-DD HH:mm:ss');
      return moment(time).format('YYYY-MM-DD HH:mm:ss');
    };
    const handleQuickShield = v => {
      dialog.quickShield.bizIds = [v.bk_biz_id];
      dialog.quickShield.show = true;
      dialog.quickShield.ids = [v.id];
      dialog.quickShield.details = [
        {
          severity: v.severity,
          dimension: v.dimension_message,
          trigger: v.description,
          strategy: {
            id: v?.strategy_id as unknown as string,
            name: v?.strategy_name
          }
        }
      ];
      handleHideMoreOperate();
    };
    const handleManualProcess = v => {
      dialog.manualProcess.alertIds = [v.id] as any;
      dialog.manualProcess.bizIds = [2]; // [v.bk_biz_id];
      manualProcessShowChange(true);
      handleHideMoreOperate();
    };
    /**
     * @description: 手动处理
     * @param {*} v
     * @return {*}
     */
    const manualProcessShowChange = (v: boolean) => {
      dialog.manualProcess.show = v;
    };
    const handleShowDetail = data => {
      console.log(data);
    };

    /**
     * @description: 一键拉群
     * @param {*} v
     * @return {*}
     */
    const handleChatGroup = v => {
      console.log(v);
      const { id, assignee, alert_name, bk_biz_id } = v;
      chatGroupDialog.assignee = assignee || [];
      chatGroupDialog.alertName = alert_name;
      chatGroupDialog.bizId = [bk_biz_id];
      chatGroupDialog.alertIds.splice(0, chatGroupDialog.alertIds.length, id);
      chatGroupShowChange(true);
      handleHideMoreOperate();
    };
    /**
     * @description: 一键拉群弹窗关闭/显示
     * @param {boolean} show
     * @return {*}
     */
    const chatGroupShowChange = (show: boolean) => {
      chatGroupDialog.show = show;
    };
    const feedbackIncidentRootApi = (isCancel = false) => {
      let params = {
        content: '',
        id: ''
      };
      if (isCancel) {
        params.is_cancel = true;
      }
      feedbackIncidentRoot(params);
    };
    const handleRootCauseConfirm = v => {
      if (v.entity.is_root) {
        feedbackIncidentRootApi(true);
        return;
      }
      dialog.rootCauseConfirm.data = v;
      dialog.rootCauseConfirm.ids = [v.id];
      dialog.rootCauseConfirm.bizIds = [v.bk_biz_id];
      dialog.rootCauseConfirm.show = true;
    };
    const handleAlertConfirm = v => {
      dialog.alarmConfirm.ids = [v.id];
      dialog.alarmConfirm.bizIds = [v.bk_biz_id];
      dialog.alarmConfirm.show = true;
      handleHideMoreOperate();
    };
    const handleAlarmDispatch = v => {
      dialog.alarmDispatch.alertIds = [v.id] as any;
      dialog.alarmDispatch.bizIds = [v.bk_biz_id];
      handleAlarmDispatchShowChange(true);
    };
    const handleEnter = (e, row, index) => {
      hoverRowIndex.value = index;
    };
    /* 告警确认文案 */
    const askTipMsg = (isAak, status, ackOperator) => {
      const statusNames = {
        RECOVERED: t('告警已恢复'),
        CLOSED: t('告警已关闭')
      };
      if (!isAak) {
        return statusNames[status];
      }
      return `${ackOperator || ''}${t('已确认')}`;
    };
    const columns = reactive([
      {
        label: '#',
        type: 'index',
        width: 40,
        minWidth: 40
      },
      {
        label: t('告警ID'),
        field: 'id',
        render: ({ data }) => {
          return (
            <span
              v-overflow-title
              class={`event-status status-${data.severity} id-column`}
              onClick={() => handleShowDetail(data)}
            >
              {data.id}
            </span>
          );
        }
      },
      {
        label: t('告警名称'),
        field: 'alert_name',
        render: ({ data }) => {
          return (
            <div
              class='name-column'
              v-overflow-title
            >
              {data.alert_name}
              {/* {data.entity.is_root && <span class='root-cause'>{t('根因')}</span>} */}
            </div>
          );
        }
      },
      {
        label: t('业务名称'),
        field: 'project',
        render: ({ data }) => {
          return `[${data.bk_biz_id}] ${data.bk_biz_name || '--'}`;
        }
      },
      {
        label: t('分类'),
        field: 'category_display',
        render: ({ data }) => {
          return data.category_display;
        }
      },
      {
        label: t('告警指标'),
        field: 'index',
        render: ({ data }) => {
          const isEmpt = !data?.metric_display?.length;
          if (isEmpt) return '--';
          const key = random(10);
          const content = (
            <div
              class='tag-column'
              id={key}
            >
              {data.metric_display.map(item => (
                <div
                  key={item.id}
                  class='tag-item set-item'
                >
                  {item.name || item.id}
                </div>
              ))}
            </div>
          );
          return (
            <div class='tag-column-wrap'>
              {content}
              <Popover
                extCls='tag-column-popover'
                maxWidth={400}
                theme='light common-table'
                placement='top'
                arrow={true}
                v-slots={{
                  default: () => content,
                  content: () => content
                }}
              ></Popover>
            </div>
          );
        }
      },
      {
        label: t('告警状态'),
        field: 'status',
        minWidth: 134,
        render: ({ data }) => {
          // is_ack: isAck, ack_operator: ackOperator
          const { status } = data;
          return (
            <div class='status-column'>
              <StatusTag status={status}></StatusTag>
            </div>
          );
        }
      },
      {
        label: t('告警阶段'),
        field: 'stage_display',
        render: ({ data }) => {
          return data?.stage_display ?? '--';
        }
      },
      {
        label: t('告警开始/结束时间'),
        field: 'time',
        minWidth: 145,
        render: ({ data }) => {
          return (
            <span class='time-column'>
              {formatterTime(data.begin_time)} / <br></br>
              {formatterTime(data.end_time)}
            </span>
          );
        }
      },
      {
        label: t('持续时间'),
        field: 'duration',
        width: 136,
        render: ({ data, index: $index }) => {
          const { status, is_ack: isAck, ack_operator: ackOperator } = data;
          return (
            <div class='status-column'>
              <span>{data.duration}</span>
              <div
                class='operate-panel-border'
                style={{
                  display: hoverRowIndex.value === $index || popoperOperateIndex.value === $index ? 'flex' : 'none'
                }}
              ></div>
              <div
                class='operate-panel'
                style={{
                  display: hoverRowIndex.value === $index || popoperOperateIndex.value === $index ? 'flex' : 'none'
                }}
              >
                <span
                  class={['operate-panel-item']}
                  onClick={() => handleRootCauseConfirm(data)}
                  v-bk-tooltips={{
                    content: t(!data.entity.is_root ? '反馈根因' : '取消反馈根因'),
                    trigger: 'hover',
                    delay: 200
                  }}
                >
                  <i
                    class={['icon-monitor', !data.entity.is_root ? 'icon-fankuixingenyin' : 'icon-mc-cancel-feedback']}
                  ></i>
                </span>
                <span
                  class='operate-panel-item'
                  onClick={() => handleAlarmDispatch(data)}
                  v-bk-tooltips={{ content: t('告警分派'), delay: 200, appendTo: 'parent' }}
                >
                  <i class='icon-monitor icon-fenpai'></i>
                </span>
                <span
                  class={['operate-more', { active: popoperOperateIndex.value === $index }]}
                  onClick={e => handleShowMoreOperate(e, $index, data)}
                >
                  <span class='icon-monitor icon-mc-more'></span>
                </span>
              </div>
            </div>
          );
        }
      }
    ]);

    const settings = ref({
      fields: columns.slice(1, columns.length - 1).map(({ label, field }) => {
        return {
          label,
          disabled: field === 'id',
          field
        };
      }),
      checked: columns.slice(1, columns.length - 1).map(({ field }) => field)
    });
    const getMoreOperate = () => {
      const { status, is_ack: isAck, ack_operator: ackOperator } = opetateRow.value;
      return (
        <div style={{ display: 'none' }}>
          <div
            class='alarm-detail-table-options-more-items'
            ref='moreItems'
          >
            <div
              class={['more-item', { 'is-disable': false }]}
              onClick={() => handleChatGroup(opetateRow.value)}
            >
              <span class='icon-monitor icon-we-com'></span>
              <span>{window.i18n.t('一键拉群')}</span>
            </div>
            <div
              class={['more-item', { 'is-disable': isAck || ['RECOVERED', 'CLOSED'].includes(status) }]}
              onClick={() =>
                !isAck && !['RECOVERED', 'CLOSED'].includes(status) && handleAlertConfirm(opetateRow.value)
              }
              v-bk-tooltips={{
                disabled: !(isAck || ['RECOVERED', 'CLOSED'].includes(status)),
                content: askTipMsg(isAck, status, ackOperator),
                delay: 200,
                appendTo: 'parent'
              }}
            >
              <span class='icon-monitor icon-duihao'></span>
              <span>{window.i18n.t('告警确认')}</span>
            </div>
            <div
              class={['more-item', { 'is-disable': false }]}
              onClick={() => handleManualProcess(opetateRow.value)}
            >
              <span class='icon-monitor icon-chuli'></span>
              <span>{window.i18n.t('手动处理')}</span>
            </div>
            <div
              class={['more-item', { 'is-disable': opetateRow.value?.is_shielded }]}
              v-bk-tooltips={{
                disabled: !opetateRow.value?.is_shielded,
                content: opetateRow?.value?.is_shielded
                  ? `${opetateRow?.value.shield_operator?.[0] || ''}${t('已屏蔽')}`
                  : '',
                delay: 200,
                appendTo: () => document.body
              }}
              onClick={() => !opetateRow.value?.is_shielded && handleQuickShield(opetateRow.value)}
            >
              <span class='icon-monitor icon-mc-notice-shield'></span>
              <span>{window.i18n.t('快捷屏蔽')}</span>
            </div>
          </div>
        </div>
      );
    };
    const handleHideMoreOperate = () => {
      popoperOperateInstance.value.hide();
      popoperOperateInstance.value.close();
      popoperOperateInstance.value = null;
      popoperOperateIndex.value = -1;
    };
    const handleShowMoreOperate = (e, index, data) => {
      popoperOperateIndex.value = index;
      console.log(e.target);
      opetateRow.value = data;
      if (!popoperOperateInstance.value) {
        popoperOperateInstance.value = $bkPopover({
          target: e.target,
          content: moreItems.value,
          arrow: false,
          trigger: 'click',
          placement: 'bottom',
          theme: 'light common-monitor',
          width: 120,
          extCls: 'alarm-detail-table-more-popover',
          onAfterHidden: () => {
            popoperOperateInstance.value.destroy();
            popoperOperateInstance.value = null;
            popoperOperateIndex.value = -1;
          }
        });
      }
      setTimeout(popoperOperateInstance.value.show, 100);
    };
    const handleLoadData = () => {
      // scrollLoading.value = true;
      //   scrollLoading.value = false;
    };
    const handleConfirmAfter = v => {};
    const alarmConfirmChange = v => {
      dialog.alarmConfirm.show = v;
      handleGetTable();
    };
    const handleAlarmDispatchShowChange = v => {
      dialog.alarmDispatch.show = v;
    };
    /* 手动处理轮询状态 */
    const handleDebugStatus = (actionIds: number[]) => {
      dialog.manualProcess.actionIds = actionIds;
      dialog.manualProcess.debugKey = random(8);
    };
    const handleMealInfo = (mealInfo: { name: string }) => {
      dialog.manualProcess.mealInfo = mealInfo;
    };
    /**
     * @description: 屏蔽成功
     * @param {boolean} v
     * @return {*}
     */
    const quickShieldSucces = (v: boolean) => {
      if (v) {
        // tableData.value.value.forEach(item => {
        //   if (dialog.quickShield.ids.includes(item.id)) {
        //     item.is_shielded = true;
        //     item.shield_operator = [window.username || window.user_name];
        //   }
        // });
      }
    };
    /* 搜索条件包含action_id 且 打开批量搜索则更新url状态 */
    const batchUrlUpdate = (type: EBatchAction | '') => {
      return;
      if (/(^action_id).+/g.test(queryString.value) || !type) {
        const key = random(10);
        const params = {
          name: this.$route.name,
          query: {
            ...handleParam2Url(),
            batchAction: type || undefined,
            key
          }
        };
        // this.$router.replace(params);
        // this.routeStateKeyList.push(key);
      }
    };
    /**
     * @description: 快捷屏蔽
     * @param {boolean} v
     * @return {*}
     */
    const quickShieldChange = (v: boolean) => {
      dialog.quickShield.show = v;
      if (!v) {
        batchUrlUpdate('');
      }
    };
    const handleGetTable = async () => {
      tableLoading.value = true;
      const params = {
        id: incidentId.value
      };
      const data = await incidentAlertList(params);
      tableLoading.value = false;
      alertData.value = data;
    };
    onMounted(() => {
      handleGetTable();
    });
    const handleAlarmDispatchSuccess = data => {
      // tableData.value.forEach(item => {
      //   if (data.ids.includes(item.id)) {
      //     if (item.appointee) {
      //       const usersSet = new Set();
      //       item.appointee.concat(data.users).forEach(u => {
      //         usersSet.add(u);
      //       });
      //       item.appointee = Array.from(usersSet) as string[];
      //     } else {
      //       item.appointee = data.users;
      //     }
      //   }
      // });
    };
    const handleChangeCollapse = ({ id, isCollapse }) => {
      if (isCollapse) {
        collapseId.value = null;
        return;
      }
      collapseId.value = id;
    };

    const handleSettingChange = ({ checked }) => {
      console.log(checked, settings.value);
    };
    const handleFeedbackChange = (val: boolean) => {
      dialog.rootCauseConfirm.show = val;
    };
    return {
      alertData,
      moreItems,
      collapseId,
      dialog,
      opetateRow,
      tableLoading,
      hoverRowIndex,
      columns,
      tableData,
      scrollLoading,
      chatGroupDialog,
      settings,
      handleSettingChange,
      quickShieldChange,
      getMoreOperate,
      handleChangeCollapse,
      alarmConfirmChange,
      quickShieldSucces,
      handleConfirmAfter,
      handleFeedbackChange,
      handleRootCauseConfirm,
      handleAlarmDispatchShowChange,
      manualProcessShowChange,
      chatGroupShowChange,
      handleMealInfo,
      handleLoadData,
      handleAlarmDispatchSuccess,
      handleDebugStatus,
      handleEnter,
      handleGetTable
    };
  },
  render() {
    return (
      <Loading loading={this.tableLoading}>
        <div class='alarm-detail bk-scroll-y'>
          <FeedbackCauseDialog
            data={this.dialog.rootCauseConfirm.data}
            visible={this.dialog.rootCauseConfirm.show}
            onChange={this.handleFeedbackChange}
            onEditSuccess={this.handleGetTable}
          ></FeedbackCauseDialog>
          <ChatGroup
            show={this.chatGroupDialog.show}
            assignee={this.chatGroupDialog.assignee}
            alarmEventName={this.chatGroupDialog.alertName}
            alertIds={this.chatGroupDialog.alertIds}
            onShowChange={this.chatGroupShowChange}
          />
          <QuickShield
            details={this.dialog.quickShield.details}
            ids={this.dialog.quickShield.ids}
            bizIds={this.dialog.quickShield.bizIds}
            show={this.dialog.quickShield.show}
            onChange={this.quickShieldChange}
            onSucces={this.quickShieldSucces}
          ></QuickShield>
          <ManualProcess
            show={this.dialog.manualProcess.show}
            bizIds={this.dialog.manualProcess.bizIds}
            alertIds={this.dialog.manualProcess.alertIds}
            onShowChange={this.manualProcessShowChange}
            onDebugStatus={this.handleDebugStatus}
            onMealInfo={this.handleMealInfo}
          ></ManualProcess>
          <AlarmDispatch
            show={this.dialog.alarmDispatch.show}
            alertIds={this.dialog.alarmDispatch.alertIds}
            bizIds={this.dialog.alarmDispatch.bizIds}
            onShow={this.handleAlarmDispatchShowChange}
            onSuccess={this.handleAlarmDispatchSuccess}
          ></AlarmDispatch>
          <AlarmConfirm
            show={this.dialog.alarmConfirm.show}
            ids={this.dialog.alarmConfirm.ids}
            bizIds={this.dialog.alarmConfirm.bizIds}
            onConfirm={this.handleConfirmAfter}
            onChange={this.alarmConfirmChange}
          ></AlarmConfirm>
          {this.getMoreOperate()}
          {this.alertData.map(item => {
            return item.alerts.length > 0 ? (
              <Collapse
                title={item.name}
                id={item.id}
                num={item.alerts.length}
                key={item.id}
                collapse={this.collapseId !== item.id}
                onChangeCollapse={this.handleChangeCollapse}
              >
                <div class='alarm-detail-table'>
                  <Table
                    columns={this.columns}
                    data={item.alerts}
                    max-height={616}
                    show-overflow-tooltip={true}
                    settings={this.settings}
                    scroll-loading={this.scrollLoading}
                    onRowMouseEnter={this.handleEnter}
                    onSettingChange={this.handleSettingChange}
                    onRowMouseLeave={() => (this.hoverRowIndex = -1)}
                    // onScrollBottom={this.handleLoadData}
                  ></Table>
                </div>
              </Collapse>
            ) : (
              ''
            );
          })}
        </div>
      </Loading>
    );
  }
});
