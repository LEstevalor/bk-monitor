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
import { Dropdown, Input } from 'bkui-vue';

import './handler-list.scss';

export default defineComponent({
  setup() {
    const { t } = useI18n();
    const filterList = [
      {
        name: t('未恢复告警数'),
        icon: 'AlertSort',
        key: ''
      },
      {
        name: t('名称 A-Z '),
        icon: 'A-ZSort',
        key: ''
      }
    ];
    const mainList = [
      {
        name: t('全部'),
        total: 164
      },
      {
        name: t('未分派'),
        total: 14
      },
      {
        name: t('我负责'),
        total: 14
      }
    ];
    const handlerList = [
      {
        name: 'Hallie Lindsey',
        total: 32
      },
      {
        name: 'William HarringtonWilliamWilliam',
        total: 0
      }
    ];
    const listFn = (list: Array<object>) => {
      return list.map((item, index) => (
        <div class={['list-item', { active: index === 2 }]}>
          <span class='item-head'></span>
          <span
            class='item-name'
            title={item.name}
          >
            {item.name}
          </span>
          {item.total === 0 ? (
            <i class='icon-monitor icon-mc-check-small item-icon'></i>
          ) : (
            <label class='item-total'>{item.total}</label>
          )}
        </div>
      ));
    };
    const searchBtnFn = () => (
      <Dropdown
        trigger='click'
        placement='bottom-start'
        v-slots={{
          content: () => (
            <Dropdown.DropdownMenu extCls={'search-btn-drop'}>
              {filterList.map(item => (
                <Dropdown.DropdownItem>
                  <i class={`icon-monitor icon-${item.icon} search-btn-icon`}></i>
                  {item.name}
                </Dropdown.DropdownItem>
              ))}
            </Dropdown.DropdownMenu>
          )
        }}
      >
        <span class='head-btn'>
          <i class='icon-monitor icon-AlertSort head-btn-icon'></i>
        </span>
      </Dropdown>
    );
    const renderFn = () => (
      <div class='handler-list'>
        <div class='handler-list-head'>
          <Input
            class='head-input'
            type='search'
            clearable
            show-clear-only-hover
            placeholder={t('搜索 故障处理人')}
          />
          {searchBtnFn()}
        </div>
        <div class='handler-list-main'>
          {listFn(mainList)}
          <span class='item-line'></span>
          {listFn(handlerList)}
        </div>
      </div>
    );
    return { renderFn };
  },
  render() {
    return this.renderFn();
  }
});
