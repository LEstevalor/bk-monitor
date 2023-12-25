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
import { defineComponent, ref, inject, Ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Collapse, Dialog, Form, Input, Message } from 'bkui-vue';
import { feedbackIncidentRoot } from '../../../../monitor-api/modules/incident';

import './feedback-cause-dialog.scss';

export default defineComponent({
  name: 'FeedbackCauseDialog',
  props: {
    visible: {
      type: Boolean,
      required: false
    },
    /** 节点信息 */
    data: {
      type: Object,
      default: () => ({})
    },
    onChange: {
      type: Function,
      default: _v => {}
    }
  },
  emits: ['editSuccess'],
  setup(props, { emit }) {
    const { t } = useI18n();
    const activeIndex = ref([0, 1]);
    const btnLoading = ref(false);
    const formData = ref({
      feedbackContent: ''
    });
    const formRef = ref('');
    const incidentDetail = inject<Ref<object>>('incidentDetail');
    const incidentDetailData = computed(() => {
      return incidentDetail.value;
    });
    function valueChange(v) {
      props.onChange(v);
    }
    const handleFeedbackIncidentRoot = () => {
      formRef.value.validate().then(() => {
        btnLoading.value = true;
        const { id, incident_id, bk_biz_id } = incidentDetailData.value;
        const params = {
          id,
          incident_id,
          bk_biz_id,
          feedback: {
            incident_root: props.data.entity.entity_id,
            content: formData.value.feedbackContent
          }
        };
        console.log(params);
        feedbackIncidentRoot(params)
          .then(() => {
            Message({
              theme: 'success',
              message: t('反馈成功')
            });
            emit('editSuccess');
          })
          .catch(() => {
            valueChange(true);
          })
          .finally(() => (btnLoading.value = false));
      });
    };

    return {
      t,
      valueChange,
      formData,
      formRef,
      activeIndex,
      handleFeedbackIncidentRoot,
      btnLoading,
      incidentDetailData
    };
  },
  render() {
    const originalFaultFn = () => <div class='fault-item'>{this.incidentDetailData?.incident_name || '--'}</div>;
    const newFeedback = () => {
      const { bk_biz_id, bk_biz_name, entity } = this.$props.data;
      const { entity_type, rank, entity_id } = entity;
      return (
        <Form
          ref='formRef'
          label-width={100}
          class='feedback-form'
          model={this.formData}
        >
          <Form.FormItem label={this.t('根因所属节点:')}>{entity_id}</Form.FormItem>
          <Form.FormItem label={this.t('分类:')}>{rank?.rank_alias || '--'}</Form.FormItem>
          <Form.FormItem label={this.t('节点类型:')}>{entity_type}</Form.FormItem>
          <Form.FormItem label={this.t('所属业务:')}>{`[${bk_biz_id}] ${bk_biz_name}`}</Form.FormItem>
          <Form.FormItem
            required
            property='feedbackContent'
            label={this.t('故障根因文案')}
          >
            <Input
              v-model={this.formData.feedbackContent}
              type='textarea'
              maxlength={300}
            />
          </Form.FormItem>
        </Form>
      );
    };
    const collapseList = [
      { name: this.t('原故障根因'), renderFn: originalFaultFn },
      { name: this.t('反馈新根因'), renderFn: newFeedback }
    ];
    return (
      <Dialog
        ext-cls='feedback-cause-dialog'
        is-show={this.$props.visible}
        title={this.t('反馈新根因')}
        dialog-type='operation'
        is-loading={this.btnLoading}
        width={660}
        onUpdate:isShow={this.valueChange}
        onConfirm={this.handleFeedbackIncidentRoot}
        onClosed={() => (this.formData.feedbackContent = '')}
      >
        <Collapse
          v-model={this.activeIndex}
          header-icon='right-shape'
          class='feedback-cause-collapse'
          list={collapseList}
          v-slots={{
            content: (item: any) => item.renderFn()
          }}
        />
      </Dialog>
    );
  }
});
