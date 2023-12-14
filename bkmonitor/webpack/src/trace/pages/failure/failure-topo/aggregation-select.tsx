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
import { defineComponent } from 'vue';
import { Input, Popover, Tree } from 'bkui-vue';
import { Search } from 'bkui-vue/lib/icon';

import './aggregation-select.scss';

const treeData = [
  {
    id: '1',
    name: '方案成熟',
    isOpen: true,
    content: '拥有支撑数百款腾讯业务的经验沉淀，兼容各种复杂的系统架构，生于运维 · 精于运维',
    children: [
      {
        id: '2',
        name: 'child-1-方案成熟-拥有支撑数百款腾讯业务的经验沉淀，兼容各种复杂的系统架构，生于运维 · 精于运维',
        content: '拥有支撑数百款腾讯业务的经验沉淀，兼容各种复杂的系统架构，生于运维 · 精于运维',
        children: []
      },
      {
        id: '3',
        name: 'child-1-覆盖全面',
        content:
          '从配置管理，到作业执行、任务调度和监控自愈，再通过运维大数据分析辅助运营决策，全方位覆盖业务运营的全周期保障管理。',
        children: []
      },
      {
        id: '4',
        name: 'child-1-开放平台',
        content: '开放的PaaS，具备强大的开发框架和调度引擎，以及完整的运维开发培训体系，助力运维快速转型升级。',
        children: [
          {
            id: '5',
            name: 'child-1-方案成熟',
            content: '拥有支撑数百款腾讯业务的经验沉淀，兼容各种复杂的系统架构，生于运维 · 精于运维',
            children: []
          },
          {
            id: '6',
            name: 'child-1-覆盖全面',
            content:
              '从配置管理，到作业执行、任务调度和监控自愈，再通过运维大数据分析辅助运营决策，全方位覆盖业务运营的全周期保障管理。',
            children: []
          },
          {
            id: '7',
            name: 'child-1-开放平台',
            isOpen: true,
            content: '开放的PaaS，具备强大的开发框架和调度引擎，以及完整的运维开发培训体系，助力运维快速转型升级。',
            children: []
          }
        ]
      }
    ]
  }
];
export default defineComponent({
  name: 'AggregationSelect',
  props: {
    options: {
      type: Array,
      default: () => []
    },
    modelValue: {
      type: [String, Number, Object],
      default: ''
    }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const updateValue = (value: string | number | object) => {
      emit('update:modelValue', value);
    };

    return {
      updateValue
    };
  },
  render() {
    return (
      <div class='aggregation-select'>
        <Popover
          trigger='click'
          arrow={false}
          extCls='aggregation-select-popover'
          v-slots={{
            default: () => (
              <div class='aggregation-select-trigger'>
                <i class='icon-monitor icon-menu-set trigger-icon'></i>
                {this.$t('聚合规则')}
              </div>
            ),
            content: () => (
              <div class='aggregation-select-content'>
                <div class='panel-header'>
                  <div class='panel-btn'>{this.$t('自动聚合')}</div>
                  <div class='panel-btn'>{this.$t('不聚合')}</div>
                </div>
                <div class='panel-search'>
                  <Input
                    placeholder={this.$t('请输入关键字')}
                    behavior='simplicity'
                    v-slots={{
                      prefix: () => <Search class='input-icon' />
                    }}
                  ></Input>
                </div>
                <Tree
                  data={treeData}
                  label='name'
                  showCheckbox
                  levelLine
                  nodeKey='id'
                  showNodeTypeIcon={false}
                ></Tree>
              </div>
            )
          }}
        ></Popover>
      </div>
    );
  }
});
