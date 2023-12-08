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
import { defineComponent, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { Collapse, Dialog, Form, Input } from 'bkui-vue';

import './feedback-cause-dialog.scss';

export default defineComponent({
  name: 'FeedbackCauseDialog',
  props: {
    visible: {
      type: Boolean,
      required: false
    },
    data: {
      type: Object,
      default: () => ({})
    },
    onChange: {
      type: Function,
      default: _v => {}
    }
  },
  setup(props) {
    const { t } = useI18n();
    const activeIndex = ref([0, 1]);
    const originalFaultFn = () => (
      <div class='fault-item'>
        Service（我是告警名称占位) 于 <b>2023-10-10 00:00:00</b> 发生异常，导致
        <b> 141</b> 个告警
      </div>
    );
    const newFeedback = () => (
      <Form
        label-width={100}
        class='feedback-form'
      >
        <Form.FormItem label={t('根因所属节点:')}>节点名称名称（id=XXXXXXX)</Form.FormItem>
        <Form.FormItem label={t('分类:')}>服务</Form.FormItem>
        <Form.FormItem label={t('节点类型:')}>Service</Form.FormItem>
        <Form.FormItem label={t('所属业务:')}>[100147] DNF 地下城与勇士</Form.FormItem>
        <Form.FormItem
          required
          label={t('故障根因文案')}
        >
          <Input
            type='textarea'
            maxlength={300}
          />
        </Form.FormItem>
      </Form>
    );
    const collapseList = ref([
      { name: t('原故障根因'), renderFn: originalFaultFn },
      { name: t('反馈新根因'), renderFn: newFeedback }
    ]);
    function valueChange(v) {
      props.onChange(v);
    }
    return {
      t,
      valueChange,
      collapseList,
      activeIndex
    };
  },
  render() {
    return (
      <Dialog
        ext-cls='feedback-cause-dialog'
        is-show={this.$props.visible}
        title={this.t('反馈新根因')}
        dialog-type='operation'
        width={660}
        onUpdate:isShow={this.valueChange}
      >
        <Collapse
          v-model={this.activeIndex}
          header-icon='right-shape'
          class='feedback-cause-collapse'
          list={this.collapseList}
          v-slots={{
            content: (item: any) => item.renderFn()
          }}
        />
      </Dialog>
    );
  }
});
