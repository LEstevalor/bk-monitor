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
import { ResizeLayout } from 'bkui-vue';

import { incidentDetail } from '../../../monitor-api/modules/incident';

import FailureContent from './failure-content/failure-content';
import FailureHeader from './failure-header/failure-header';
import FailureNav from './failure-nav/failure-nav';
import FailureTags from './failure-tags/failure-tags';

import './failure.scss';

export default defineComponent({
  setup() {
    const tagDomHeight = ref<Number>(40);
    const collapseTagHandle = (val: boolean, height: Number) => {
      tagDomHeight.value = height;
    };
    const incidentDetailData = ref({});
    const getIncidentDetail = () => {
      incidentDetail({
        bk_biz_id: 2,
        id: 17016602963
      })
        .then(res => {
          incidentDetailData.value = res;
          // console.log(res, '=====', incidentDetailData);
          // console.log(incidentDetailData, 'incidentDetailData')
          // provide('incidentDetail', incidentDetailData.value);
        })
        .catch(err => {
          console.log(err);
        });
    };
    onMounted(() => {
      getIncidentDetail();
    });
    return { tagDomHeight, collapseTagHandle, incidentDetailData };
  },
  render() {
    return (
      <div class='failure-wrapper'>
        <FailureHeader incidentDetail={this.incidentDetailData} />
        <FailureTags
          incidentDetail={this.incidentDetailData}
          onCollapse={this.collapseTagHandle}
        />
        <ResizeLayout
          class='failure-content-layout'
          style={{ height: `calc(100vh - ${160 + Number(this.tagDomHeight)}px)` }}
          auto-minimize={400}
          border={false}
          collapsible
          initial-divide={500}
          v-slots={{
            aside: () => <FailureNav></FailureNav>,
            main: () => <FailureContent></FailureContent>
          }}
        ></ResizeLayout>
      </div>
    );
  }
});
