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
import { computed, defineComponent, onMounted, provide, reactive, readonly, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { Button, DatePicker, Input, TagInput } from 'bkui-vue';
import { random } from 'lodash';

import { getReceiver } from '../../../monitor-api/modules/notice_group';
import NavBar from '../../components/nav-bar/nav-bar';

import { getCalendar, setPreviewDataOfServer } from './components/calendar-preview';
import FixedRotationTab, { FixedDataModel } from './components/fixed-rotation-tab';
import FormItem from './components/form-item';
import ReplaceRotationTab, { ReplaceDataModel } from './components/replace-rotation-tab';
import RotationCalendarPreview from './components/rotation-calendar-preview';
import { RotationSelectTypeEnum, RotationTabTypeEnum } from './typings/common';
import { mockRequest } from './mockData';
import { fixedRotationTransform, replaceRotationTransform } from './utils';

import './rotation-config.scss';

interface RotationTypeData {
  [RotationTabTypeEnum.REGULAR]: FixedDataModel[];
  [RotationTabTypeEnum.HANDOFF]: ReplaceDataModel;
}

export default defineComponent({
  name: 'RotationConfig',
  setup() {
    const { t } = useI18n();
    const router = useRouter();
    const route = useRoute();
    const id = computed(() => route.params.id);
    /* 路由 */
    const navList = ref([{ name: t('新增轮值'), id: '' }]);
    const formData = reactive({
      name: '',
      labels: [],
      effective: {
        startTime: '',
        endTime: ''
      }
    });
    const previewData = ref([]);
    /**
     * 表单错误信息
     */
    const errMsg = reactive({
      name: '',
      effective: '',
      rotationType: ''
    });

    function handleEffectiveChange(val: string, type: 'startTime' | 'endTime') {
      formData.effective[type] = val;
    }

    // --------------轮值类型-------------------
    const defaultUserGroup = ref([]);
    provide('defaultGroup', readonly(defaultUserGroup));
    const rotationType = ref<RotationTabTypeEnum>(RotationTabTypeEnum.HANDOFF);
    const fixedRotationTabRef = ref<InstanceType<typeof FixedRotationTab>>();
    const replaceRotationTabRef = ref<InstanceType<typeof ReplaceRotationTab>>();
    const rotationTypeData = reactive<RotationTypeData>({
      regular: [],
      handoff: {
        id: undefined,
        date: {
          type: RotationSelectTypeEnum.WorkDay,
          workTimeType: 'time_range',
          isCustom: false,
          customTab: 'duration',
          customWorkDays: [],
          value: [{ key: random(8, true), workTime: [], workDays: [], periodSettings: { unit: 'hour', duration: 1 } }]
        },
        users: {
          type: 'specified',
          groupNumber: 1,
          value: [{ key: random(8, true), value: [] }]
        }
      }
    });
    function handleRotationTypeDataChange<T extends RotationTabTypeEnum>(val: RotationTypeData[T], type: T) {
      rotationTypeData[type] = val;
      getPreviewData();
    }
    function getGroupList() {
      getReceiver().then(data => {
        defaultUserGroup.value = data;
      });
    }

    // -----------------表单----------------
    /**
     * 表单校验
     * @returns 是否校验成功
     */
    function validate() {
      let valid = true;
      const rotationValid = validRotationRule();
      // 清空错误信息
      Object.keys(errMsg).forEach(key => (errMsg[key] = ''));
      // 轮值类型
      if (rotationValid.err) {
        errMsg.rotationType = rotationValid.msg;
        valid = false;
      }
      // 生效时间范围
      if (!formData.effective.startTime) {
        errMsg.effective = t('生效起始时间必填');
        valid = false;
      }
      // 规则名称
      if (!formData.name) {
        errMsg.name = t('该项必填');
        valid = false;
      }
      return valid;
    }

    function validRotationRule() {
      const res = { err: false, msg: '' };
      const data = rotationTypeData[rotationType.value];
      if (rotationType.value === RotationTabTypeEnum.REGULAR) {
        const hasUsers = (data as FixedDataModel[]).every(item => item.users.length);
        if (!hasUsers) {
          res.err = true;
          res.msg = t('用户必填');
        }
      } else {
        const hasUsers = (data as ReplaceDataModel).users.value.some(item => item.value.length);
        if (!hasUsers) {
          res.err = true;
          res.msg = t('用户必填');
        }
      }
      return res;
    }

    function getParams() {
      let dutyArranges;
      // 轮值类型数据转化
      if (rotationType.value === RotationTabTypeEnum.REGULAR) {
        dutyArranges = fixedRotationTransform(rotationTypeData.regular, 'params');
      } else {
        dutyArranges = replaceRotationTransform(rotationTypeData.handoff, 'params');
      }
      const { name, labels, effective } = formData;
      const params = {
        id: id.value,
        name,
        category: rotationType.value,
        labels,
        duty_arranges: dutyArranges,
        effective_time: effective.startTime,
        end_time: effective.endTime
      };
      return params;
    }

    function handleSubmit() {
      if (!validate()) return;
      const params = getParams();
      console.log(params);
    }

    function getData() {
      mockRequest(rotationType.value).then((res: any) => {
        rotationType.value = res.category;
        formData.name = res.name;
        formData.labels = res.labels;
        formData.effective.startTime = res.effective_time || '';
        formData.effective.endTime = res.end_time || '';
        if (res.category === 'regular') {
          rotationTypeData.regular = fixedRotationTransform(res.duty_arranges, 'data');
        } else {
          rotationTypeData.handoff = replaceRotationTransform(res.duty_arranges, 'data');
        }
      });
    }

    /**
     * @description 获取预览数据
     */
    function getPreviewData() {
      const dutyParams = getParams();
      const startDate = getCalendar()[0][0];
      const beginTime = `${startDate.year}-${startDate.month + 1}-${startDate.day} 00:00`;
      const params = {
        begin_time: beginTime,
        days: 31,
        source_type: 'API',
        config: dutyParams
      };
      console.log(params);
      previewData.value = setPreviewDataOfServer([]);
    }

    onMounted(() => {
      id.value && getData();
      getGroupList();
    });

    function handleBack() {
      router.push({
        name: 'rotation'
      });
    }

    function handleBackPage() {
      router.back();
    }

    return {
      t,
      navList,
      formData,
      errMsg,
      handleEffectiveChange,
      rotationType,
      fixedRotationTabRef,
      replaceRotationTabRef,
      rotationTypeData,
      previewData,
      handleRotationTypeDataChange,
      handleSubmit,
      handleBack,
      handleBackPage
    };
  },
  render() {
    return (
      <div class='rotation-config-page'>
        <NavBar
          routeList={this.navList}
          needBack={true}
          callbackRouterBack={this.handleBackPage}
        ></NavBar>
        <div class='rotation-config-page-content'>
          <FormItem
            label={this.$t('规则名称')}
            require
            class='mt-24'
            errMsg={this.errMsg.name}
          >
            <Input
              class='width-508'
              v-model={this.formData.name}
            ></Input>
          </FormItem>
          <FormItem
            label={this.$t('标签')}
            class='mt-24'
          >
            <TagInput
              class='width-508'
              v-model={this.formData.labels}
              allowCreate
            ></TagInput>
          </FormItem>
          <FormItem
            label={this.$t('轮值类型')}
            require
            errMsg={this.errMsg.rotationType}
            class='mt-24'
          >
            <div class='rotation-type-wrapper'>
              <div class='tab-list'>
                <div
                  class={['tab-list-item fixed', this.rotationType === RotationTabTypeEnum.REGULAR && 'active']}
                  onClick={() => (this.rotationType = RotationTabTypeEnum.REGULAR)}
                >
                  {this.t('固定值班')}
                </div>
                <div
                  class={['tab-list-item replace', this.rotationType === RotationTabTypeEnum.HANDOFF && 'active']}
                  onClick={() => (this.rotationType = RotationTabTypeEnum.HANDOFF)}
                >
                  {this.t('交替轮值')}
                </div>
              </div>
              <div class='tab-content'>
                {this.rotationType === RotationTabTypeEnum.REGULAR ? (
                  <FixedRotationTab
                    ref='fixedRotationTabRef'
                    data={this.rotationTypeData.regular}
                    onChange={val => this.handleRotationTypeDataChange(val, RotationTabTypeEnum.REGULAR)}
                  />
                ) : (
                  <ReplaceRotationTab
                    ref='replaceRotationTabRef'
                    v-show={this.rotationType === RotationTabTypeEnum.HANDOFF}
                    data={this.rotationTypeData.handoff}
                    onChange={val => this.handleRotationTypeDataChange(val, RotationTabTypeEnum.HANDOFF)}
                  />
                )}
              </div>
            </div>
          </FormItem>
          <FormItem
            label={this.$t('生效时间范围')}
            require
            class='mt-24'
            errMsg={this.errMsg.effective}
          >
            <DatePicker
              modelValue={this.formData.effective.startTime}
              clearable
              type='datetime'
              placeholder={`${this.t('如')}: 2019-01-30 12:12:21`}
              onChange={val => this.handleEffectiveChange(val, 'startTime')}
            ></DatePicker>
            <span class='split-line'>-</span>
            <DatePicker
              class='effective-end'
              modelValue={this.formData.effective.endTime}
              clearable
              type='datetime'
              placeholder={this.t('永久')}
              onChange={val => this.handleEffectiveChange(val, 'endTime')}
            ></DatePicker>
          </FormItem>
          <FormItem
            label={this.$t('轮值预览')}
            class='mt-24'
          >
            <RotationCalendarPreview
              class='width-974'
              value={this.previewData}
            ></RotationCalendarPreview>
          </FormItem>
          <FormItem class='mt-32'>
            <Button
              theme='primary'
              class='mr-8 width-88'
              onClick={this.handleSubmit}
            >
              {this.$t('提交')}
            </Button>
            <Button
              class='width-88'
              onClick={this.handleBack}
            >
              {this.$t('取消')}
            </Button>
          </FormItem>
        </div>
      </div>
    );
  }
});