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
import { useI18n } from 'vue-i18n';
import { Input, Select, Tree } from 'bkui-vue';

import './handle-search.scss';

export default defineComponent({
  setup() {
    const { t } = useI18n();
    const treeList = [
      {
        name: t('未恢复'),
        icon: 'mind-fill',
        total: 10,
        level: 1,
        children: [
          {
            name: '容器状态异常',
            total: 3,
            level: 2,
            children: [
              {
                name: 'pod_id=coredns-59234fs',
                level: 3
              },
              {
                name: 'pod_id=coredns-59234fs',
                level: 3
              },
              {
                name: 'pod_id=coredns-59234fs',
                level: 3
              }
            ]
          }
        ]
      },
      {
        name: t('已恢复'),
        icon: 'mc-check-fill',
        total: 2,
        level: 1,
        children: [
          {
            name: 'pod近30分钟重启次数过多',
            total: 3,
            level: 2
          }
        ]
      },
      {
        name: t('已解决'),
        icon: 'mc-solved',
        total: 2,
        level: 1,
        children: [
          {
            name: '日志平台-es磁盘容量告警-全局',
            total: 3,
            level: 2
          }
        ]
      },
      {
        name: t('已失效'),
        icon: 'mc-expired',
        total: 2,
        level: 1,
        children: [
          {
            name: '日志平台-es磁盘容量告警-全局',
            total: 3,
            level: 2
          }
        ]
      }
    ];
    const searchHeadFn = () => (
      <div class='handle-search-top'>
        <Select
          class='top-select'
          prefix={t('业务筛选')}
        />
        <Input
          placeholder={t('请输入搜索条件')}
          v-slots={{
            prefix: () => {
              return <i class='icon-monitor icon-filter-fill prefix-slot'></i>;
            },
            suffix: () => {
              return (
                <span class='suffix-slot'>
                  <i class='icon-monitor icon-mc-uncollect suffix-icon' />
                  {t('收藏')}
                </span>
              );
            }
          }}
        />
      </div>
    );
    const getPrefixIcon = (item, renderType) => {
      const { icon, level } = item;
      if (renderType === 'node_action') {
        return 'default';
      }
      let showIcon = level === 2 ? 'gaojing1' : 'Pod';
      if (level === 1) {
        showIcon = icon;
      }
      return <i class={`icon-monitor icon-${showIcon} tree-icon ${icon}`} />;
    };
    const treeFn = () => (
      <Tree
        class='search-tree-list'
        data={treeList}
        label='name'
        children='children'
        level-line
        prefix-icon={getPrefixIcon}
        auto-open-parent-node={false}
        v-slots={{
          nodeAppend: (node: any) => (node.level === 3 ? '' : <span class='node-append'>{node.total}</span>)
        }}
      />
    );
    const listFn = () => (
      <div class='handle-search-list'>
        <div class='search-head'>
          {t('我负责的告警')}
          <i class='icon-monitor icon-menu-setting search-head-icon' />
        </div>
        <div class='search-tree'>{treeFn()}</div>
      </div>
    );
    const renderFn = () => (
      <div class='handle-search'>
        {searchHeadFn()}
        {listFn()}
      </div>
    );
    return { renderFn };
  },
  render() {
    return this.renderFn();
  }
});
