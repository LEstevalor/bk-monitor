/*
 * Tencent is pleased to support the open source community by making BK-LOG 蓝鲸日志平台 available.
 * Copyright (C) 2021 THL A29 Limited, a Tencent company.  All rights reserved.
 * BK-LOG 蓝鲸日志平台 is licensed under the MIT License.
 *
 * License for BK-LOG 蓝鲸日志平台:
 * --------------------------------------------------------------------
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT
 * LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE
 */

import { Component as tsc } from 'vue-tsx-support';
import {
  Component,
  Prop,
  Emit,
} from 'vue-property-decorator';
import {
  Button,
  Tab,
  TabPanel,
} from 'bk-magic-vue';
import MonacoEditor from '../../components/collection-access/components/step-add/monaco-editor.vue';
import $http from '../../api';
import './masking-field-input.scss';

@Component
export default class MaskingFieldInput extends tsc<{}> {
  @Prop({ type: Number, required: true }) indexSetId: number;
  /** 当前活跃的日志采样下标 */
  activeTab = '0'
  /** 缓存的日志json列表 */
  catchJsonList = []
  /** 是否钉住 */
  inputFix = false
  /** 是否正在改变输入框高度 */
  isChangingHeight = false
  /** 输入框最小高度 */
  collectMinHeight = 160
  /** 输入框最大高度 */
  collectMaxHeight = 600
  /** 当前收藏容器的高度 */
  currentTreeBoxHeight = null
  currentScreenY = null
  /** 当前收藏容器的高度 */
  collectHeight = 160
  /** 日志采样列表 */
  jsonValueList = [{
    id: 0,
    jsonStr: '',
    catchJsonStr: '',
    isJsonError: false,
    name: '0',
    label: window.mainComponent.$t('日志采样'),
  }];
  /** 是否展示无法同步规则tips */
  isShowCannotCreateRuleTips = false
  /** JSON格式错误tips */
  isJSONStrError = false
  /** 日志查询loading */
  inputLoading = false
  /** 当前活跃的日志采样的元素 */
  get activeJsonValue() {
    return this.jsonValueList[this.activeTab];
  }
  /** 获取所有输入框的json元素列表 */
  get getJsonParseList() {
    return this.jsonValueList
      .filter(item => this.isHaveValJSON(item.jsonStr))
      .map(item => JSON.parse(item.jsonStr));
  }

  @Emit('change')
  hiddenSlider() {
    return false;
  }

  @Emit('blurInput')
  handleBlurInput(isPreview = true) {
    return { list: this.getJsonParseList, isPreview };
  }

  @Emit('createRule')
  emitCreateRule() {}


  mounted() {
    // 初始化日志采样输入框
    this.handleRefreshConfigStr(false);
  }

  /**
   * @desc: 获取当前日志查询字符串
   */
  async handleRefreshConfigStr(isPreview = true) {
    try {
      this.inputLoading = true;
      const res = await $http.request('masking/getMaskingSearchStr', {
        params: { index_set_id: this.indexSetId },
      });
      if (res.data.list.length) {
        // 缓存当前的日志
        this.catchJsonList = res.data.list;
        const index = Number(this.activeTab);
        // 编辑器当前的第一个日志
        this.activeJsonValue.jsonStr = JSON.stringify(this.catchJsonList[index] ?? '', null, 4);
      };
      this.handleBlurConfigInput(isPreview);
    } catch (err) {
      return '';
    } finally {
      this.inputLoading = false;
    }
  }

  /**
   * @desc: 输入框失焦触发
   */
  async handleBlurConfigInput(isPreview = true) {
    // 与缓存的字符串一样 不更新
    if (this.activeJsonValue.jsonStr === this.activeJsonValue.catchJsonStr) return;
    this.activeJsonValue.catchJsonStr = this.activeJsonValue.jsonStr;

    this.handleBlurInput(isPreview);
  }

  /**
   * @desc: 一键生成规则
   */
  async handleCreateRule() {
    this.isShowCannotCreateRuleTips = !this.activeJsonValue.jsonStr;
    this.isJSONStrError = this.activeJsonValue.isJsonError;
    this.emitCreateRule();
  }
  /** 切换采样 */
  tabChange(val) {
    this.activeTab = val;
  }
  /** 添加采样 */
  addPanel() {
    const id = this.jsonValueList.length;
    const catchStrValue = JSON.stringify(this.catchJsonList[id] ?? {}, null, 4);
    this.jsonValueList.push({
      id,
      jsonStr: catchStrValue === '{}' ? '' : catchStrValue,
      catchJsonStr: '',
      name: String(id),
      isJsonError: false,
      label: `${this.$t('日志采样')}${id}`,
    });
    this.activeTab = String(id);
    this.handleBlurInput();
  }
  /** 删除采样 */
  closePanel(index: number) {
    const actIndex = Number(this.activeTab);
    if (index === 0) return;
    // 当删除的下标和展示的下标相同时 直接展示第一个日志采样
    if (actIndex === index) this.activeTab = '0';
    // 当删除的下标小于展示的下标时 当前活跃的下标要 -1
    if (actIndex - index >= 1) this.activeTab = String(actIndex - 1);
    this.jsonValueList.splice(index, 1);
    // 更新日志采样名
    this.jsonValueList.forEach((item, index) => {
      const id = index;
      item.id = id;
      item.name = String(id);
      item.label = `${this.$t('日志采样')}${id ? id : ''}`;
    });
    this.handleBlurInput();
  }

  /**
   * @desc: 判断当前字符串是否是json格式并且有值
   * @param {String} str 字符串
   * @returns {Boolean}
   */
  isHaveValJSON(str: string): boolean {
    try {
      JSON.parse(str);
      return JSON.parse(str) && str !== '{}';
    } catch (error) {
      return false;
    }
  }

  /** 控制页面布局宽度 */
  dragBegin(e) {
    e.stopPropagation();
    this.isChangingHeight = true;
    this.currentTreeBoxHeight = this.collectHeight;
    this.currentScreenY = e.screenY;
    window.addEventListener('mousemove', this.dragMoving, { passive: true });
    window.addEventListener('mouseup', this.dragStop, { passive: true });
  }
  dragMoving(e) {
    const newTreeBoxHeight = this.currentTreeBoxHeight + e.screenY - this.currentScreenY;
    if (newTreeBoxHeight <= this.collectMinHeight) {
      this.collectHeight = this.collectMinHeight;
      this.dragStop();
    } else if (newTreeBoxHeight >= this.collectMaxHeight) {
      this.collectHeight = this.collectMaxHeight;
    } else {
      this.collectHeight = newTreeBoxHeight;
    }
  }
  dragStop() {
    this.isChangingHeight = false;
    this.currentTreeBoxHeight = null;
    this.currentScreenY = null;
    window.removeEventListener('mousemove', this.dragMoving);
    window.removeEventListener('mouseup', this.dragStop);
  }

  render() {
    return (
      <div class={['item-container field-input', { 'input-fix': this.inputFix }]}>
        <div class="item-title">
          <div class="left">
            <span class="title">{this.$t('采样日志')}</span>
            <span class="alert">{this.$t('日志脱敏会结合您的采样日志自动匹配并选用规则，无采样日志无法展示预览结果，请确认您的采样日志规范。若有多类日志，可粘贴至下方采样框内')}</span>
          </div>
          <div class="right-fix" onClick={() => this.inputFix = !this.inputFix}>
            <i class={['log-icon', this.inputFix ? 'icon-fix-shape' : 'icon-fix-line']}></i>
            <span class="text">{this.inputFix ? this.$t('取消钉住') : this.$t('钉住')}</span>
          </div>
        </div>
        <Tab
          closable
          type="border-card"
          active={this.activeTab}
          on-tab-change={this.tabChange}
          on-close-panel={this.closePanel}>
            <div slot="setting" class="text-btn" onClick={() => this.handleRefreshConfigStr()}>
              <i class="icon bk-icon icon-right-turn-line"></i>
              <span class="text">{this.$t('刷新')}</span>
            </div>
            <div slot="add" onClick={this.addPanel}>
              <div class="text-btn">
                <i class="icon bk-icon icon-plus push"></i>
                <span class="text">{this.$t('新增采样')}</span>
              </div>
            </div>
            {
              this.jsonValueList.map((panel, index) => (
              <TabPanel {...{ props: panel }} key={index} />
              ))
            }
            <div class="json-editor" v-bkloading={{ isLoading: this.inputLoading }}>
              <MonacoEditor
                v-model={this.activeJsonValue.jsonStr}
                is-show-top-label={false}
                is-show-problem-drag={false}
                theme="vs"
                language="json"
                height={this.collectHeight}
                font-size={14}
                on-get-problem-state={(err: boolean) => this.activeJsonValue.isJsonError = err}
                on-blur={() => this.handleBlurConfigInput()}>
              </MonacoEditor>
            </div>
            <div
              class={['drag-right', { 'drag-ing': this.isChangingHeight }]}
              onMousedown={this.dragBegin}
            ></div>
        </Tab>
        <div class="sync-rule-box">
          <Button
            theme="primary"
            size="small"
            outline
            onClick={() => this.handleCreateRule()}>
              {this.$t('自动匹配脱敏规则')}
          </Button>
          {
            this.isShowCannotCreateRuleTips && <span>{this.$t('未检测到日志采样内容，无法同步规则')}</span>
          }
          {
            this.isJSONStrError && <span>{this.$t('当前日志不符合JSON格式，请确认后重试')}</span>
          }
        </div>
      </div>
    );
  }
}