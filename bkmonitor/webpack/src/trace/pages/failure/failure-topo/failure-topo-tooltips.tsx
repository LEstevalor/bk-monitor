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
import { defineComponent, VNode, ref, getCurrentInstance } from 'vue';

import { ITopoNode } from './types';
import { Popover } from 'bkui-vue';
import { $bkPopover } from 'bkui-vue/lib/popover';
import './failure-topo-tooltips.scss';
import { divide } from 'lodash';

export default defineComponent({
  props: {
    /** 显示查看资源的icon */
    showViewResource: {
      type: Boolean,
      default: true
    },
    type: {
      type: String,
      default: 'node'
    },
    model: {
      type: [Object, Array],
      required: true
    }
  },
  emits: ['viewResource', 'FeedBack'],
  setup(props, { emit }) {
    const activeNode = ref(null);
    const popover = ref(null);
    const { proxy } = getCurrentInstance();

    const popoperOperateInstance = ref(null);
    const handleViewResource = () => {
      emit('viewResource', props.model);
    };
    const handleFeedBack = () => {
      emit('FeedBack', props.model);
    };
    const handleShowNodeTips = (node: ITopoNode) => {
      activeNode.value = node;
    };
    const hide = () => {
      if (!activeNode?.value?.id) {
        return;
      }
      proxy.$refs?.[`popover_${activeNode.value.id}`]?.hide?.();
      activeNode.value = null;
    };
    return {
      popover,
      activeNode,
      hide,
      handleShowNodeTips,
      handleViewResource,
      handleFeedBack
    };
  },
  render() {
    if (!this.model) return undefined;
    const { aggregated_nodes } = this.model;
    const createEdgeNodeItem = (node: ITopoNode) => {
      return (
        <div class='node-source'>
          <span class='node-item'>
            <i class={['item-source', !node?.entity?.is_anomaly && 'item-source-normal']}></i>
          </span>
          {node?.entity?.entity_type}(<span class='node-name'>{node?.entity?.entity_name || '--'}</span>）
        </div>
      );
    };
    const createEdgeNodeLink = () => {
      return (
        <div class='node-link'>
          <div class='node-link-text'>{this.$t('从属关系')}</div>
        </div>
      );
    };
    const createEdgeToolTip = (nodes: ITopoNode[]) => {
      return [
        <div class='edge-tooltip-title'>
          {this.$t('边：')} {nodes?.[0]?.entity.entity_name} - {nodes?.[1]?.entity.entity_name}
        </div>,
        <div class='edge-tooltip-content'>
          {createEdgeNodeItem(nodes[0])}
          {createEdgeNodeLink()}
          {createEdgeNodeItem(nodes[1])}
        </div>
      ];
    };
    const createCommonIconBtn = (name: string, style?: Record<string, any>, needIcon = true, clickFn = '') => {
      return (
        <span
          class='icon-btn'
          style={{ ...style }}
          onClick={() => clickFn && this[`handle${clickFn}`]()}
        >
          {needIcon && (
            <i class={['icon-monitor', 'btn-icon', clickFn === 'FeedBack' ? 'icon-fankuixingenyin' : 'icon-trend']} />
          )}
          <span
            class='btn-text'
            v-overflowTitle
          >
            {name}
          </span>
        </span>
      );
    };
    const createCommonForm = (label: string, value: () => VNode) => {
      return (
        <div class='content-form'>
          <div class='content-form-label'>{label}</div>
          <div class='content-form-value'>{value?.()}</div>
        </div>
      );
    };
    const createNodeToolTipList = (node: ITopoNode) => {
      const { aggregated_nodes, total_count, anomaly_count } = node;
      const createNodeItem = (node, index) => {
        // return (
        //   <li
        //     onClick={this.handleShowNodeTips.bind(this, node, index)}
        //     class='tool-tips-list-item'
        //   >
        //     <span>
        //       <i
        //         class='item-source'
        //         style={{
        //           width: '16px',
        //           height: '16px',
        //           minWidth: '16px',
        //           flex: '0 0 16px'
        //         }}
        //       ></i>
        //       <span>{node.entity.entity_name}</span>
        //     </span>
        //     <i class='icon-monitor icon-arrow-right'></i>
        //   </li>
        // );
        return (
          <Popover
            ref={'popover_' + node.id}
            trigger='click'
            renderType='shown'
            placement='right'
            extCls='failure-topo-tooltips-popover'
            v-slots={{
              content: <div class='failure-topo-tooltips'>{createNodeToolTip(node)}</div>,
              default: (
                <li
                  onClick={this.handleShowNodeTips.bind(this, node)}
                  class={['tool-tips-list-item', this.activeNode?.id === node.id && 'active']}
                >
                  <span>
                    <i
                      class={['item-source', !node?.entity?.is_anomaly && 'item-source-normal']}
                      style={{
                        width: '16px',
                        height: '16px',
                        minWidth: '16px',
                        flex: '0 0 16px'
                      }}
                    ></i>
                    <span>{node.entity.entity_name}</span>
                  </span>
                  <i class='icon-monitor icon-arrow-right'></i>
                </li>
              )
            }}
            onAfterHidden={() => (this.activeNode = null)}
          ></Popover>
        );
      };
      return (
        <div class='tool-tips-list-wrap'>
          {/* <Popover
            ref='popover'
            v-slots={{
              content: <div class='failure-topo-tooltips'>{createNodeToolTip(node)}</div>
            }}
            onAfterHidden={() => (this.activeNode = null)}
          ></Popover> */}
          <span class='title-wrap'>
            <i18n-t
              tag='span'
              class='tool-tips-list-title'
              keypath={
                (anomaly_count as number) > 0 ? '共 {slot0} 个 Pod节点，其中 {slot1} 个异常' : '共 {slot0} 个 Pod节点'
              }
              v-slots={{
                slot0: () => <span class='weight'>{total_count}</span>,
                slot1: () => <span class='weight error-color'>{anomaly_count}</span>
              }}
            ></i18n-t>
          </span>
          <ul class='tool-tips-list'>{[createNodeItem(node, -1), ...aggregated_nodes.map(createNodeItem)]}</ul>
        </div>
      );
    };
    const createNodeToolTip = (node: ITopoNode) => {
      return (
        <div class='node-tooltip'>
          <div class='node-tooltip-header'>
            <i
              class={['item-source', !node?.entity?.is_anomaly && 'item-source-normal']}
              style={{
                width: '16px',
                height: '16px',
                minWidth: '16px',
                flex: '0 0 16px'
              }}
            ></i>
            <span class='header-name'>{node.entity.entity_name}</span>
            {node.entity.is_root && (
              <span
                class='root-mark'
                style={{
                  backgroundColor: node.entity.is_root ? '#EA3636' : '#00FF00'
                }}
              >
                {this.$t('根因')}
              </span>
            )}
            {this.showViewResource &&
              createCommonIconBtn(
                this.$t('查看资源'),
                {
                  marginLeft: 'auto'
                },
                true,
                'ViewResource'
              )}
            {!node.is_feedback_root &&
              !node.entity.is_root &&
              node.entity.is_anomaly &&
              createCommonIconBtn(
                this.$t('反馈新根因'),
                {
                  marginLeft: '16px'
                },
                true,
                'FeedBack'
              )}
          </div>
          <div class='node-tooltip-content'>
            {createCommonForm(this.$t('包含告警：'), () =>
              node.alert_display.alert_name ? (
                <>
                  <span class='flex-label'>
                    {createCommonIconBtn(
                      node.alert_display.alert_name || '',
                      {
                        marginRight: '4px'
                      },
                      false
                    )}
                  </span>
                  <span class='flex-text'>
                    等共
                    {createCommonIconBtn(
                      node.alert_ids.length.toString(),
                      {
                        marginRight: '4px',
                        marginLeft: '4px'
                      },
                      false
                    )}
                    个同类告警
                  </span>
                </>
              ) : (
                <>--</>
              )
            )}
            {createCommonForm(this.$t('分类：'), () => (
              <>{node.entity.rank.rank_category.category_alias}</>
            ))}
            {createCommonForm(this.$t('节点类型：'), () => (
              <>{node.entity.entity_type}</>
            ))}
            {createCommonForm(this.$t('所属业务：'), () => (
              <>
                [{node.bk_biz_id}] {node.bk_biz_name}
              </>
            ))}
          </div>
        </div>
      );
    };
    // const
    return (
      <div
        class={{
          'failure-topo-tooltips': true,
          'edge-tooltip': this.type === 'edge'
        }}
      >
        {this.type === 'edge'
          ? createEdgeToolTip(this.model as ITopoNode[])
          : aggregated_nodes.length > 0
          ? createNodeToolTipList(this.model as ITopoNode)
          : createNodeToolTip(this.model as ITopoNode)}
      </div>
    );
  }
});
