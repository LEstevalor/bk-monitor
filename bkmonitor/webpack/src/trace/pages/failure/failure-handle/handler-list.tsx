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
import { computed, defineComponent, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Dropdown, Exception, Input, Loading } from 'bkui-vue';
import { useIncidentInject } from '../utils';
import { incidentHandlers } from '../../../../monitor-api/modules/incident';

import './handler-list.scss';

interface IHandleListItem {
  alert_count: number;
  id: string;
  index?: number;
  name: string;
  children?: Array<IHandleListItem>;
}
interface IHandleData {
  all: object;
  mine: object;
  not_dispatch: object;
  other: object;
}
export default defineComponent({
  setup() {
    const { t } = useI18n();
    const handlersList = ref<IHandleData>({
      all: {},
      mine: {},
      not_dispatch: {},
      other: {}
    });
    const orderByType = ref('abnormal_alert_count');
    const listLoading = ref(false);
    const isShowDropdown = ref(false);
    const searchText = ref('');
    const incidentId = useIncidentInject();
    const getIncidentHandlers = () => {
      listLoading.value = true;
      incidentHandlers({
        bk_biz_id: 2,
        id: incidentId,
        order_by: orderByType.value
      })
        .then(res => {
          handlersList.value = res;
        })
        .catch(err => {
          console.log(err);
        })
        .finally(() => (listLoading.value = false));
    };
    const filterList = [
      {
        name: t('未恢复告警数'),
        icon: 'AlertSort',
        key: 'abnormal_alert_count'
      },
      {
        name: t('名称 A-Z '),
        icon: 'A-ZSort',
        key: 'bk_username'
      }
    ];
    const searchResult = computed(() => {
      let result = handlersList.value.other?.children || [];
      if (searchText.value !== '') {
        result = (handlersList.value.other?.children || []).filter(operation =>
          operation.id.includes(searchText.value)
        );
      }
      return result;
    });
    const filterListHandle = (key: string) => {
      orderByType.value = key;
      getIncidentHandlers();
      isShowDropdown.value = false;
    };
    const handleClickItem = (item: IHandleListItem) => {
      console.log(item);
    };
    const listFn = (list: Array<IHandleListItem>, isShowEmpty = false) => {
      if (isShowEmpty && list.length === 0) {
        return (
          <Exception
            type='empty'
            scene='part'
            description={searchText.value !== '' ? t('搜索数据为空') : t('暂无数据')}
          >
            {searchText.value !== '' && (
              <span
                class='clear-btn'
                onClick={() => (searchText.value = '')}
              >
                {t('清空筛选条件')}
              </span>
            )}
          </Exception>
        );
      }
      return list.map((item: IHandleListItem, index) => (
        <div
          class={['list-item', { active: index === 2 }]}
          onClick={() => handleClickItem(item)}
        >
          <i class={`icon-monitor icon-mc-all head-icon`} />
          <span class='item-head'>
            <i class={`icon-monitor icon-mc-${item.id === 'all' ? 'user-one' : 'user-one'} head-icon`} />
          </span>
          <span
            class='item-name'
            title={item.name}
          >
            {item.name}
          </span>
          {item.alert_count === 0 ? (
            <i class='icon-monitor icon-mc-check-small item-icon'></i>
          ) : (
            <label class='item-total'>{item.alert_count}</label>
          )}
        </div>
      ));
    };
    onMounted(() => {
      getIncidentHandlers();
    });
    return {
      isShowDropdown,
      listFn,
      handlersList,
      t,
      listLoading,
      filterList,
      orderByType,
      filterListHandle,
      searchText,
      searchResult
    };
  },
  render() {
    const { all = {}, mine = {}, not_dispatch = {} } = this.handlersList;
    return (
      <div class='handler-list'>
        <div class='handler-list-head'>
          <Input
            class='head-input'
            type='search'
            clearable
            show-clear-only-hover
            v-model={this.searchText}
            placeholder={this.t('搜索 故障处理人')}
            on-clear={() => (this.searchText = '')}
          />
          <Dropdown
            trigger='manual'
            is-show={this.isShowDropdown}
            placement='bottom-start'
            v-slots={{
              content: () => (
                <Dropdown.DropdownMenu extCls={'search-btn-drop'}>
                  {this.filterList.map(item => (
                    <Dropdown.DropdownItem
                      extCls={`${this.orderByType === item.key ? 'active' : ''}`}
                      onclick={() => this.filterListHandle(item.key)}
                    >
                      <i class={`icon-monitor icon-${item.icon} search-btn-icon`}></i>
                      {item.name}
                    </Dropdown.DropdownItem>
                  ))}
                </Dropdown.DropdownMenu>
              )
            }}
          >
            <span
              class='head-btn'
              onClick={() => (this.isShowDropdown = true)}
            >
              <i
                class={`icon-monitor icon-${
                  this.filterList.filter(item => this.orderByType === item.key)[0].icon
                } head-btn-icon`}
              />
            </span>
          </Dropdown>
        </div>
        <Loading loading={this.listLoading}>
          <div class='handler-list-main'>
            {this.listFn([all, mine])}
            <span class='item-line'></span>
            {this.listFn(this.searchResult, true)}
          </div>
        </Loading>
      </div>
    );
  }
});
