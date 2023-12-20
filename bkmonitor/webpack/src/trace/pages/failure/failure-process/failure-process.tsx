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
import { computed, defineComponent, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Exception, Input, Loading, Popover, Tree } from 'bkui-vue';
import { CogShape } from 'bkui-vue/lib/icon';
import moment from 'moment';

import {
  incidentOperations,
  incidentOperationTypes,
  incidentRecordOperation
} from '../../../../monitor-api/modules/incident';
import { useIncidentInject } from '../utils';

import './failure-process.scss';

export default defineComponent({
  props: {
    steps: {
      type: Array,
      default: () => []
    }
  },
  setup() {
    const renderStep = () => {};
    const { t } = useI18n();
    const handleSetting = () => {};
    const queryString = ref('');
    const hidePopover = ref(false);
    const operations = ref([]);
    const operationTypes = ref([]);
    const operationTypeMap = ref({});
    const checkedNodes = ref([]);
    const tableLoading = ref(false);
    const incidentId = useIncidentInject();
    /** 时间过滤 */
    const formatterTime = (time: number | string): string => {
      if (!time) return '--';
      if (typeof time !== 'number') return time;
      if (time.toString().length < 13) return moment(time * 1000).format('YYYY-MM-DD HH:mm:ss');
      return moment(time).format('YYYY-MM-DD HH:mm:ss');
    };
    const incidentRecordOperationApi = params => {
      incidentRecordOperation(params);
    };
    const handleHide = () => {
      hidePopover.value = true;
    };
    /** 渲染tag */
    const renderHandlers = handles => {
      return handles.length ? handles.map(tag => <span class='tag-item'>{tag}</span>) : '--';
    };

    const handleChecked = (select, filterSelect) => {
      const result = select.filter(item => !filterSelect.find(filter => filter.id === item.id));
      checkedNodes.value = result.map(item => item.id);
    };
    /** 前端搜索 */
    const searchOperations = computed(() => {
      let result = operations.value;
      if (checkedNodes.value.length > 0) {
        result = operations.value.filter(operation => checkedNodes.value.includes(operation.operation_type));
      }
      if (queryString.value !== '') {
        result = operations.value.filter(operation => operation.str.includes(queryString.value));
      }
      return result;
    });

    /** 文案对应表 */
    const typeTextMap = {
      incident_create: '生成故障，包含{alert_count}个告警，故障负责人：{assignees}',
      incident_observe: '故障观察中，剩余观察时间{last_minutes}分钟',
      incident_recover: '故障已恢复',
      incident_notice: '故障通知已发送（接收人：{receivers}）',
      incident_merge: '故障{merged_incident_name}被合并入当前故障',
      incident_update: '故障属性{incident_key}: 从{from_value}被修改为{to_value}',
      alert_trigger: '检测到新告警（{alert_name}）',
      alert_recover: '告警已恢复（{alert_name}）',
      alert_invalid: '告警已失效（{alert_name}）',
      alert_notice: '告警通知已发送（{alert_name}；接收人：{receivers}）',
      alert_convergence: '告警已收敛（共包含{converged_count}个关联的告警事件）',
      manual_update: '故障属性{incident_key}: 从{from_value}被修改为{to_value}',
      feedback: '反馈根因：{feedback_incident_root}',
      incident_close: '故障已关闭',
      group_gather: '一键拉群（{group_name}）',
      alert_confirm: '告警已确认（{alert_name}）',
      alert_shield: '告警已屏蔽（{alert_name}）',
      alert_handle: '告警已被手动处理（{alert_name}）',
      alert_close: '告警已被关闭（{alert_name}）',
      alert_dispatch: '告警已分派（{alert_name}；处理人：{handlers}）'
    };
    /** 将动态文案填入 */
    const replaceStr = (str, extra_info) => {
      return str.replace(/{(\w+)}/g, (match, key) => {
        // 检查这个键是否在对象中
        if (key in extra_info) {
          return extra_info[key]; // 如果是，则替换为对象中的值
        } else {
          return match; // 如果不是，则不替换，返回原始匹配字符串
        }
      });
    };
    /** 各类型文案渲染函数 */
    const renderMap = reactive({
      incident_create: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['incident_create']}
            v-slots={{
              alert_count: () => <span class='count'>{extra_info.alert_count}</span>,
              assignees: () => <span class='tag-wrap'>{renderHandlers(extra_info.assignees)}</span>
            }}
          ></i18n-t>
        );
      },
      incident_observe: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['incident_observe']}
            v-slots={{
              last_minutes: <span class='count'>{extra_info?.last_minutes || 0}</span>
            }}
          ></i18n-t>
        );
      },
      incident_recover: () => {
        return <span>{t(typeTextMap['incident_recover'])}</span>;
      },
      incident_notice: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['incident_notice']}
            v-slots={{
              receivers: () => <span class='tag-wrap'>{renderHandlers(extra_info.receivers)}</span>
            }}
          ></i18n-t>
        );
      },
      incident_merge: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['incident_merge']}
            v-slots={{
              merged_incident_name: <span class='link'>{extra_info?.merged_incident_name || ''}</span>
            }}
          ></i18n-t>
        );
      },
      incident_update: ({ extra_info }) => {
        const { incident_key, from_value, to_value } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['incident_update']}
            v-slots={{
              incident_key: () => <span>{operationTypeMap[incident_key]}</span>,
              from_value: () => <span class='link'>{from_value}</span>,
              to_value: () => <span class='link'>{to_value}</span>
            }}
          ></i18n-t>
        );
      },
      alert_trigger: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_trigger']}
            v-slots={{
              alert_name: (
                <span
                  class='link cursor'
                  onClick={() => {}}
                >
                  {extra_info.alert_name}
                </span>
              )
            }}
          ></i18n-t>
        );
      },
      alert_recover: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_recover']}
            v-slots={{
              alert_name: (
                <span
                  class='link cursor'
                  onClick={() => {}}
                >
                  {extra_info.alert_name}
                </span>
              )
            }}
          ></i18n-t>
        );
      },
      alert_invalid: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_invalid']}
            v-slots={{
              alert_name: (
                <span
                  class='link cursor'
                  onClick={() => {}}
                >
                  {extra_info.alert_name}
                </span>
              )
            }}
          ></i18n-t>
        );
      },
      alert_notice: ({ extra_info }) => {
        const { receivers, alert_name } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['alert_notice']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{alert_name}</span>,
              receivers: () => <span class='tag-wrap'>{renderHandlers(receivers)}</span>
            }}
          ></i18n-t>
        );
      },
      alert_convergence: ({ extra_info }) => {
        const { alert_name, converged_count } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['alert_convergence']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{alert_name}</span>,
              converged_count: () => <span class='count'>{converged_count}</span>
            }}
          ></i18n-t>
        );
      },
      // <-- 以下为人工事件  -->
      manual_update: ({ extra_info }) => {
        const { incident_key, from_value, to_value } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['manual_update']}
            v-slots={{
              incident_key: () => <span>{operationTypeMap[incident_key]}</span>,
              from_value: () => <span class='link'>{from_value}</span>,
              to_value: () => <span class='link'>{to_value}</span>
            }}
          ></i18n-t>
        );
      },
      feedback: ({ extra_info }) => {
        const { feedback_incident_root } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['feedback']}
            v-slots={{
              feedback_incident_root: () => <span class='link'>{feedback_incident_root}</span>
            }}
          ></i18n-t>
        );
      },
      incident_close: () => {
        return <span>{t(typeTextMap['incident_close'])}</span>;
      },
      group_gather: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['group_gather']}
            v-slots={{
              group_name: () => <span class='link'>{extra_info.group_name || '--'}</span>
            }}
          ></i18n-t>
        );
      },
      alert_confirm: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_confirm']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{extra_info.alert_name}</span>
            }}
          ></i18n-t>
        );
      },
      alert_shield: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_shield']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{extra_info.alert_name}</span>
            }}
          ></i18n-t>
        );
      },
      alert_handle: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_handle']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{extra_info.alert_name}</span>
            }}
          ></i18n-t>
        );
      },
      // 告警关闭
      alert_close: ({ extra_info }) => {
        return (
          <i18n-t
            keypath={typeTextMap['alert_close']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{extra_info.alert_name}</span>
            }}
          ></i18n-t>
        );
      },
      alert_dispatch: ({ extra_info }) => {
        const { alert_name, handlers } = extra_info;
        return (
          <i18n-t
            keypath={typeTextMap['alert_dispatch']}
            v-slots={{
              alert_name: () => <span class='link cursor'>{alert_name}</span>,
              handlers: () => <span class='tag-wrap'>{renderHandlers(handlers)}</span>
            }}
          ></i18n-t>
        );
      }
    });

    const getIncidentOperations = () => {
      incidentOperations({
        incident_id: incidentId.value
      })
        .then(res => {
          res.forEach(item => {
            const { operation_type, extra_info } = item;
            item.str = replaceStr(typeTextMap[operation_type], extra_info);
          });
          operations.value = res;
          console.log(res);
        })
        .catch(err => {
          console.log(err);
        });
    };
    const getIncidentOperationTypes = () => {
      tableLoading.value = true;
      incidentOperationTypes({
        incident_id: incidentId.value
      })
        .then(res => {
          res.forEach(item => {
            item.id = item.operation_class;
            item.name = item.operation_class_alias;
            item.operation_types.forEach(type => {
              type.id = type.operation_type;
              type.name = type.operation_type_alias;
              operationTypeMap.value[type.id] = type.name;
            });
            const isAddLineIndex = item.operation_types.findIndex(type => type.id.startsWith('alert'));
            item.operation_types[isAddLineIndex - 1].isAddLine = true;
          });
          operationTypes.value = res;
        })
        .catch(err => {
          console.log(err);
        })
        .finally(() => (tableLoading.value = false));
    };
    const handleClearSearch = () => {
      queryString.value = '';
      checkedNodes.value = [];
    };
    onMounted(() => {
      getIncidentOperationTypes();
      getIncidentOperations();
    });
    return {
      renderMap,
      queryString,
      operationTypeMap,
      tableLoading,
      checkedNodes,
      searchOperations,
      operations,
      operationTypes,
      renderStep,
      handleHide,
      handleClearSearch,
      formatterTime,
      handleChecked,
      handleSetting
    };
  },
  render() {
    return (
      <div class='failure-process'>
        <div class='failure-process-search'>
          <Input
            placeholder={this.$t('搜索 流转记录')}
            v-model={this.queryString}
          ></Input>

          <Popover
            trigger='click'
            theme='light'
            width='242'
            extCls='failure-process-search-setting-popover'
            placement='bottom-center'
            arrow={false}
            onAfterHidden={this.handleHide}
          >
            {{
              default: (
                <span
                  v-bk-tooltips={{ content: this.$t('设置展示类型') }}
                  class='failure-process-search-setting'
                  onClick={this.handleSetting}
                >
                  <CogShape></CogShape>
                </span>
              ),
              content: (
                <div class='failure-process-search-setting-tree'>
                  <Tree
                    data={this.operationTypes}
                    selected={this.checkedNodes}
                    node-key='id'
                    children='operation_types'
                    expand-all={true}
                    indent={24}
                    showNodeTypeIcon={false}
                    show-checkbox={true}
                    selectable={false}
                    prefix-icon={true}
                    label='name'
                    onNodeChecked={this.handleChecked}
                  >
                    {{
                      default: ({ data, attributes }) => {
                        return (
                          <span class='failure-process-search-setting-tree-node'>
                            {attributes.parent && (
                              <i
                                class={[
                                  'icon-monitor',
                                  data.id.startsWith('alert') ? 'icon-gaojing1' : 'icon-mc-fault'
                                ]}
                              ></i>
                            )}
                            {data.name}
                            {data.isAddLine ? <span class='node-line'></span> : ''}
                          </span>
                        );
                      }
                    }}
                  </Tree>
                </div>
              )
            }}
          </Popover>
        </div>
        <Loading loading={this.tableLoading}>
          {this.searchOperations.length ? (
            <ul class='failure-process-list'>
              {this.searchOperations.map((operation, index) => {
                return (
                  <li
                    class='failure-process-item'
                    key={`${operation.operation_type}_${index}`}
                  >
                    <div class='failure-process-item-avatar'>
                      {index !== this.searchOperations.length - 1 && <span class='failure-process-list-line'></span>}
                      {/* <img
                      src=''
                      alt=''
                    /> */}
                      <i
                        class={[
                          'icon-monitor item-icon',
                          // eslint-disable-next-line no-nested-ternary
                          operation.operation_class !== 'system'
                            ? operation.operation_type.startsWith('alert')
                              ? 'icon-gaojing1'
                              : 'icon-mc-fault'
                            : 'icon-mc-user-one'
                        ]}
                      ></i>
                    </div>
                    <div class='failure-process-item-content'>
                      <p>
                        <span class='failure-process-item-time'>{this.formatterTime(operation.create_time)}</span>
                        <span class='failure-process-item-title'>
                          {this.operationTypeMap[operation.operation_type] || '--'}
                        </span>
                      </p>
                      <p class='failure-process-item-flex'>
                        {this.renderMap[operation.operation_type]?.(operation) || '--'}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Exception
              type='empty'
              scene='part'
              description={
                this.checkedNodes.length || this.queryString !== '' ? this.$t('搜索数据为空') : this.$t('暂无数据')
              }
            >
              {this.checkedNodes.length || this.queryString !== '' ? (
                <span
                  class='link cursor'
                  onClick={this.handleClearSearch}
                >
                  {this.$t('清空筛选条件')}
                </span>
              ) : (
                ''
              )}
            </Exception>
          )}
        </Loading>
      </div>
    );
  }
});
