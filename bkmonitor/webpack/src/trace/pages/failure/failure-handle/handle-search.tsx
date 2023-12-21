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
import { defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Input, Loading, Select, Tree, PopConfirm, Checkbox } from 'bkui-vue';
import { BkCheckboxGroup } from 'bkui-vue/lib/checkbox';

import { incidentAlertAggregate } from '../../../../monitor-api/modules/incident';
// import FilterSearchMain from './filter-search-main';
import { useIncidentInject } from '../utils';
import './handle-search.scss';

export default defineComponent({
  setup() {
    const { t } = useI18n();
    const alertAggregateData = ref([]);
    const listLoading = ref(false);
    const isShowDropdown = ref(false);
    const cacheAggregateData = ref([]);
    const aggregateBysList = [
      {
        name: t('节点层级'),
        key: 'node_level'
      },
      {
        name: t('节点类型'),
        key: 'node_type'
      },
      {
        name: t('告警名称'),
        key: 'alert_name'
      },
      {
        name: t('节点名称'),
        key: 'node_name'
      },
      {
        name: t('指标名称'),
        key: 'metric_name'
      }
    ];
    const aggregateBys = ref(['alert_name', 'node_name']);
    const incidentId = useIncidentInject();
    const filterListHandle = (key: string) => {
      if (aggregateBys.value.includes(key)) {
        aggregateBys.value = aggregateBys.value.filter(item => item !== key);
      } else {
        aggregateBys.value.push(key);
      }
    };
    const searchHeadFn = () => (
      <div class='handle-search-top'>
        {/* <FilterSearchMain /> */}
        <Select
          class='top-select'
          prefix={t('空间筛选')}
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
    const getIncidentAlertAggregate = () => {
      listLoading.value = true;
      incidentAlertAggregate({
        bk_biz_id: 2,
        id: incidentId,
        aggregate_bys: aggregateBys.value
      })
        .then(res => {
          alertAggregateData.value = Object.values(res);
          // console.log(res, alertAggregateData.value);
        })
        .catch(err => {
          console.log(err);
        })
        .finally(() => (listLoading.value = false));
    };
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
    const handleFilter = () => {
      getIncidentAlertAggregate();
      cacheAggregateData.value = JSON.parse(JSON.stringify(aggregateBys.value));
    };
    const cancelFilter = () => {
      aggregateBys.value = cacheAggregateData.value;
    };
    const treeFn = () => (
      <Tree
        class='search-tree-list'
        data={alertAggregateData.value}
        label='name'
        children='children'
        level-line
        prefix-icon={getPrefixIcon}
        auto-open-parent-node={false}
        v-slots={{
          nodeAppend: (node: any) => <span class='node-append'>{node.count}</span>
        }}
      />
    );
    const listFn = () => (
      <div class='handle-search-list'>
        <div class='search-head'>
          {t('我负责的告警')}
          <Dropdown
            ext-cls='aggregate-dropdown'
            trigger='manual'
            is-show={isShowDropdown.value}
            placement='bottom-start'
            v-slots={{
              content: () => (
                <Dropdown.DropdownMenu extCls={'search-btn-drop'}>
                  {aggregateBysList.map(item => (
                    <Dropdown.DropdownItem
                      // extCls={`${this.orderByType === item.key ? 'active' : ''}`}
                      onclick={() => this.filterListHandle(item.key)}
                    >
                      {item.name}
                    </Dropdown.DropdownItem>
                  ))}
                </Dropdown.DropdownMenu>
              )
            }}
          >
            <i class='icon-monitor icon-menu-setting search-head-icon' />
          </Dropdown>
        </div>
        <Loading loading={listLoading.value}>
          <div class='search-tree'>{treeFn()}</div>
        </Loading>
      </div>
    );
    const renderFn = () => (
      <div class='handle-search'>
        {searchHeadFn()}
        {listFn()}
      </div>
    );
    onMounted(() => {
      getIncidentAlertAggregate();
      cacheAggregateData.value = JSON.parse(JSON.stringify(aggregateBys.value));
    });
    return {
      t,
      renderFn,
      searchHeadFn,
      filterListHandle,
      isShowDropdown,
      listLoading,
      treeFn,
      aggregateBysList,
      aggregateBys,
      handleFilter,
      cancelFilter
    };
  },
  render() {
    return (
      <div class='handle-search'>
        {this.searchHeadFn()}
        <div class='handle-search-list'>
          <div class='search-head'>
            {this.t('我负责的告警')}
            <PopConfirm
              width='148'
              trigger='click'
              placement={'bottom-start'}
              onConfirm={this.handleFilter}
              onCancel={this.cancelFilter}
              v-slots={{
                content: () => (
                  <div class='drop-main'>
                    <div class='drop-main-title'>{this.t('设置聚合维度')}</div>
                    <BkCheckboxGroup
                      class='drop-main-list'
                      v-model={this.aggregateBys}
                    >
                      {this.aggregateBysList.map(item => (
                        <Checkbox
                          disabled={this.aggregateBys.length === 1 && this.aggregateBys.includes(item.key)}
                          label={item.key}
                          size={'small'}
                          class='drop-item drop-item-checkbox'
                        >
                          {item.name}
                        </Checkbox>
                      ))}
                    </BkCheckboxGroup>
                  </div>
                )
              }}
            >
              <i class='icon-monitor icon-menu-setting search-head-icon' />
            </PopConfirm>
            {/* <Dropdown
              ext-cls='aggregate-dropdown'
              trigger='click'
              // is-show={this.isShowDropdown}
              placement='bottom-start'
              v-slots={{
                content: () => (
                  <Dropdown.DropdownMenu extCls={'aggregate-btn-drop'}>
                    {this.aggregateBysList.map(item => (
                      <Dropdown.DropdownItem
                        extCls={`${this.aggregateBys.includes(item.key) ? 'active' : ''}`}
                        onclick={() => this.filterListHandle(item.key)}
                      >
                        {item.name}
                        {this.aggregateBys.includes(item.key) && (
                          <i class='icon-monitor icon-mc-check-small active-icon' />
                        )}
                      </Dropdown.DropdownItem>
                    ))}
                  </Dropdown.DropdownMenu>
                )
              }}
            >
              <i class='icon-monitor icon-menu-setting search-head-icon' />
            </Dropdown> */}
          </div>
          <Loading loading={this.listLoading}>
            <div class='search-tree'>{this.treeFn()}</div>
          </Loading>
        </div>
      </div>
    );
  }
});
