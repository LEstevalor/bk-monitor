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
import { Dialog, Form, Input, Radio, TagInput } from 'bkui-vue';

import './failure-edit-dialog.scss';

export default defineComponent({
  name: 'FailureEditDialog',
  props: {
    data: {
      type: Object,
      default: () => {}
    },
    visible: {
      type: Boolean,
      required: false
    },
    levelList: {
      type: Object,
      default: () => {}
    },
    onChange: {
      type: Function,
      default: _v => {}
    }
  },
  setup(props) {
    const { t } = useI18n();
    function valueChange(v) {
      props.onChange(v);
    }
    const renderFn = () => (
      <Dialog
        ext-cls='failure-edit-dialog'
        is-show={props.visible}
        title={t('编辑故障属性')}
        dialog-type='operation'
        onUpdate:isShow={valueChange}
      >
        <Form form-type={'vertical'}>
          <Form.FormItem
            label={t('故障名称')}
            required
          >
            <Input
              placeholder={t('由中英文、下划线或数字组成')}
              v-model={props.data.incident_name}
              maxlength={50}
            />
          </Form.FormItem>
          <Form.FormItem
            label={t('故障级别')}
            required
          >
            {Object.values(props.levelList || {}).map((item: any) => (
              <Radio
                v-model={props.data.level}
                label={item.name}
              >
                <i class={`icon-monitor icon-${item.key} radio-icon ${item.key}`}></i>
                {item.label}
              </Radio>
            ))}
          </Form.FormItem>
          <Form.FormItem
            label={t('故障负责人')}
            required
          >
            <TagInput
              allow-create
              has-delete-icon
              collapse-tags
            />
          </Form.FormItem>
          <Form.FormItem label={t('故障标签')}>
            <TagInput
              allow-create
              has-delete-icon
              collapse-tags
            />
          </Form.FormItem>
          <Form.FormItem label={t('故障原因')}>
            <Input
              type='textarea'
              maxlength={300}
              v-model={props.data.incident_reason}
            />
          </Form.FormItem>
        </Form>
      </Dialog>
    );
    return {
      renderFn
    };
  },
  render() {
    return this.renderFn();
  }
});
