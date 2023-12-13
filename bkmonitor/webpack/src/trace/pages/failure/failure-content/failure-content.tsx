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
import { defineComponent, KeepAlive, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AlarmDetail from '../alarm-detail/alarm-detail';
import FailureMenu from '../failure-menu/failure-menu';
import FailureTopo from '../failure-topo/failure-topo';

import './failure-content.scss';

export default defineComponent({
  setup() {
    const { t } = useI18n();
    const active = ref('FailureTopo');
    const tabList = [
      {
        name: 'FailureTopo',
        label: t('故障拓扑')
      },
      {
        name: 'AlarmDetail',
        label: t('告警明细')
      }
    ];

    const handleChangeActive = (activeName: string) => {
      active.value = activeName;
    };
    return {
      tabList,
      active,
      handleChangeActive
    };
  },
  render() {
    return (
      <div class='failure-content'>
        <FailureMenu
          tabList={this.tabList}
          active={this.active}
          onChange={this.handleChangeActive}
        ></FailureMenu>
        <KeepAlive>
          {this.active === 'FailureTopo' && <FailureTopo></FailureTopo>}
          {this.active === 'AlarmDetail' && <AlarmDetail></AlarmDetail>}
        </KeepAlive>
      </div>
    );
  }
});
