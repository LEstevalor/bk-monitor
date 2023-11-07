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
import { computed, defineComponent, onUnmounted, PropType, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tag, TimePicker } from 'bkui-vue';
import moment from 'moment';

import { getEventPaths } from '../../../../monitor-pc/utils';

import './time-tag-picker.scss';

interface CurrentTimeModel {
  value: string[];
  index: number;
  show: boolean;
}

export default defineComponent({
  name: 'TimeTagPicker',
  props: {
    /** 名称 */
    label: { type: String, default: '' },
    /** 名称宽度 */
    labelWidth: { type: Number, default: 52 },
    /** 已选择时间 */
    modelValue: { type: Array as PropType<string[][]>, default: () => [] }
  },
  emits: ['update:modelValue', 'change'],
  setup(props, { emit }) {
    const { t } = useI18n();

    const timeTagPickerRef = ref();
    const sourceValue = ref<string[][]>([]);
    const localValue = reactive<string[][]>([]);
    watch(
      () => props.modelValue,
      val => {
        localValue.splice(0, localValue.length, ...val);
        sourceValue.value = [...val];
      },
      {
        immediate: true
      }
    );
    const isChange = computed(() => {
      if (sourceValue.value.length !== localValue.length) return true;
      return localValue.some(val => !sourceValue.value.some(source => source[0] === val[0] && source[1] === val[1]));
    });

    const currentTime = reactive<CurrentTimeModel>({
      /** 当前输入的时间 */
      value: [],
      /** 当前时间索引，用于判断是否是编辑 */
      index: -1,
      /** 时间选择器是否展示 */
      show: false
    });

    watch(
      () => currentTime.show,
      val => {
        if (val) {
          document.addEventListener('click', handleConfirm);
        } else {
          document.removeEventListener('click', handleConfirm);
        }
      }
    );

    onUnmounted(() => {
      document.removeEventListener('click', handleConfirm);
    });

    /**
     * 打开时间选择器
     * @param time 时间选择器回填的时间
     * @param ind 索引
     */
    function handleShowTime(time?: string[], ind?: number) {
      currentTime.index = ind ?? -1;
      currentTime.value = time ? [...time] : [];
      currentTime.show = !currentTime.show;
    }

    /**
     * 格式化时间Tag名称格式
     * @param time 时间
     * @returns 格式化后的名称
     */
    function tagNameFormat(time: string[]) {
      const isBefore = moment(time[0], 'hh:mm').isSameOrBefore(moment(time[1], 'hh:mm'));
      return isBefore ? time.join(' - ') : `${time[0]} - ${t('次日')}${time[1]}`;
    }

    /**
     * 删除时间
     * @param ind 索引
     */
    function handleTagClose(ind: number) {
      localValue.splice(ind, 1);
      handleEmitData();
    }

    /**
     * 确认选择时间
     */
    function handleConfirm(e: Event) {
      if (timeTagPickerRef.value.contains(e.target as Node) || getEventPaths(e, '.time-picker-popover').length) return;
      if (!currentTime.value.length) {
        currentTime.show = false;
        return;
      }
      // 新增时间
      if (currentTime.index === -1) {
        localValue.push([...currentTime.value]);
      } else {
        // 编辑时间
        localValue.splice(currentTime.index, 1, [...currentTime.value]);
      }
      currentTime.show = false;
      handleEmitData();
    }

    /**
     * 提交本地数据
     */
    function handleEmitData() {
      if (isChange.value) {
        emit('update:modelValue', localValue);
        emit('change', localValue);
      }
    }

    return {
      t,
      timeTagPickerRef,
      localValue,
      currentTime,
      tagNameFormat,
      handleShowTime,
      handleTagClose,
      handleConfirm
    };
  },
  render() {
    return (
      <div
        class='time-tag-picker-wrapper-component'
        ref='timeTagPickerRef'
      >
        {this.label && (
          <div
            class='label'
            style={{ width: `${this.labelWidth}px` }}
          >
            {this.label}
          </div>
        )}
        <TimePicker
          class='time-picker'
          v-model={this.currentTime.value}
          type='timerange'
          format='hh:mm'
          open={this.currentTime.show}
          append-to-body
          allow-cross-day
          ext-popover-cls='time-picker-popover'
        >
          {{
            trigger: () => (
              <div
                class='content'
                onClick={() => this.handleShowTime()}
              >
                <i class='icon-monitor icon-mc-time icon'></i>
                <div class='time-tag-list'>
                  {this.localValue.map((item, ind) => (
                    <Tag
                      class='time-tag'
                      closable
                      onClick={() => this.handleShowTime(item, ind)}
                      onClose={() => this.handleTagClose(ind)}
                    >
                      {this.tagNameFormat(item)}
                    </Tag>
                  ))}
                  {!this.localValue.length && <span class='placeholder'>{this.t('请选择')}</span>}
                </div>
              </div>
            )
          }}
        </TimePicker>
      </div>
    );
  }
});