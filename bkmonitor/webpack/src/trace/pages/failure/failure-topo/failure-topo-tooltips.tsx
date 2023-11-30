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
import { defineComponent, VNode } from 'vue';

import { NodeStatus } from './topo-data';

import './failure-topo-tooltips.scss';

export default defineComponent({
  props: {
    type: {
      type: String,
      default: 'node'
    },
    model: {
      type: Object,
      required: true
    }
  },
  setup() {},
  render() {
    if (!this.model) return undefined;
    const createEdgeNodeItem = () => {
      return (
        <div class='node-source'>
          <span class='node-item'>
            <i class='item-source'></i>
          </span>
          Pod(<span class='node-name'>我是 Pod 名称占位</span>）
        </div>
      );
    };
    const createEdgeNodeLink = () => {
      return (
        <div class='node-link'>
          <div class='node-link-text'>从属关系</div>
        </div>
      );
    };
    const createEdgeToolTip = () => {
      return [
        <div class='edge-tooltip-title'>边：Host 名称1 - Pod名称1</div>,
        <div class='edge-tooltip-content'>
          {createEdgeNodeItem()}
          {createEdgeNodeLink()}
          {createEdgeNodeItem()}
        </div>
      ];
    };
    const createCommonIconBtn = (name: string, style?: Record<string, any>, needIcon = true) => {
      return (
        <div
          class='icon-btn'
          style={{ ...style }}
        >
          {needIcon && <i class='icon-monitor icon-trend btn-icon' />}
          <span class='btn-text'>{name}</span>
        </div>
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
    const createNodeToolTip = () => {
      return (
        <div class='node-tooltip'>
          <div class='node-tooltip-header'>
            <i
              class='item-source'
              style={{
                width: '16px',
                height: '16px'
              }}
            ></i>
            <span class='header-name'>节点名称占位</span>
            {this.model.status === NodeStatus.Root && (
              <span
                class='root-mark'
                style={{
                  backgroundColor: this.model.status === NodeStatus.Root ? '#EA3636' : '#00FF00'
                }}
              >
                根因
              </span>
            )}
            {createCommonIconBtn('查看资源', {
              marginLeft: 'auto'
            })}
          </div>
          <div class='node-tooltip-content'>
            {createCommonForm('包含告警：', () => (
              <>
                {createCommonIconBtn(
                  '告警名称占位',
                  {
                    marginRight: '4px'
                  },
                  false
                )}
                等共
                {createCommonIconBtn(
                  '10',
                  {
                    marginRight: '4px',
                    marginLeft: '4px'
                  },
                  false
                )}
                同类告警
              </>
            ))}
            {createCommonForm('分类：', () => (
              <>主机/云平台 - 主机设备</>
            ))}
            {createCommonForm('节点类型：', () => (
              <>Node/Host</>
            ))}
            {createCommonForm('所属业务：', () => (
              <>[100342] DNF 地下城与勇士</>
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
        {this.type === 'edge' ? createEdgeToolTip() : createNodeToolTip()}
      </div>
    );
  }
});
