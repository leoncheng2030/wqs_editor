import { Fragment, computed, createCommentVNode, createElementBlock, createElementVNode, normalizeClass, openBlock, ref, renderList, renderSlot, toDisplayString, vModelText, watch, withDirectives } from "vue";
import { marked } from "marked";
var __plugin_vue_export_helper_default = (e, u) => {
	let d = e.__vccOpts || e;
	for (let [e, f] of u) d[e] = f;
	return d;
}, _hoisted_1 = {
	key: 0,
	class: "markdown-editor__toolbar"
}, _hoisted_2 = { class: "markdown-editor__panes" }, _hoisted_3 = { class: "markdown-editor__editor-pane" }, _hoisted_4 = { class: "markdown-editor__editor-shell" }, _hoisted_5 = {
	key: 0,
	class: "markdown-editor__gutter"
}, _hoisted_6 = ["readonly", "placeholder"], _hoisted_7 = {
	key: 0,
	class: "markdown-editor__preview-pane"
}, _hoisted_8 = ["innerHTML"], MarkdownEditor_default = /* @__PURE__ */ __plugin_vue_export_helper_default({
	__name: "MarkdownEditor",
	props: {
		modelValue: {
			type: String,
			default: ""
		},
		theme: {
			type: String,
			default: "dark",
			validator: (e) => ["dark", "light"].includes(e)
		},
		readOnly: {
			type: Boolean,
			default: !1
		},
		showLineNumbers: {
			type: Boolean,
			default: !0
		},
		showToolbar: {
			type: Boolean,
			default: !0
		},
		showPreview: {
			type: Boolean,
			default: !0
		},
		autofocus: {
			type: Boolean,
			default: !1
		},
		placeholder: {
			type: String,
			default: ""
		},
		toolbarItems: {
			type: Array,
			default: () => [
				"h1",
				"h2",
				"bold",
				"italic",
				"unordered-list",
				"ordered-list",
				"blockquote",
				"code-block",
				"horizontal-rule",
				"link",
				"image"
			]
		}
	},
	emits: [
		"update:modelValue",
		"change",
		"save",
		"focus",
		"blur"
	],
	setup(C, { emit: w }) {
		let T = C, E = w, D = ref(T.modelValue || "# 欢迎使用 Markdown 编辑器\n\n## 快速上手\n\n- 左侧是自研编辑器（带行号、代码风格）\n- 右侧实时预览渲染效果\n- Tab 支持缩进，Ctrl+B 支持加粗\n"), O = ref(null);
		marked.setOptions({ breaks: !0 });
		let k = computed(() => marked.parse(D.value)), A = computed(() => D.value ? D.value.split("\n") : [""]);
		watch(() => T.modelValue, (e) => {
			e !== D.value && (D.value = e || "");
		});
		let j = (e) => {
			T.readOnly || (D.value = e, E("update:modelValue", e), E("change", e));
		}, M = () => {
			j(D.value);
		}, N = (e) => {
			if (T.readOnly) return;
			let u = O.value;
			if (!u) return;
			let d = D.value, f = u.selectionStart, p = u.selectionEnd, m = d.lastIndexOf("\n", f - 1) + 1, h = d.indexOf("\n", p), g = h === -1 ? d.length : h, _ = d.slice(0, m), v = d.slice(m, g), y = d.slice(g);
			D.value = _ + v.split("\n").map((u, d) => e(u, d)).join("\n") + y, requestAnimationFrame(() => {
				u.focus();
			}), M();
		}, P = (e, u) => {
			if (T.readOnly) return;
			let d = O.value;
			if (!d) return;
			let f = D.value, p = d.selectionStart, m = d.selectionEnd, h = f.slice(p, m), g = h.startsWith(e) && h.endsWith(u) && h.length > e.length + u.length, _ = h || "", v = g ? _.slice(e.length, _.length - u.length) : `${e}${_ || "文本"}${u}`, y = f.slice(0, p), b = f.slice(m);
			D.value = y + v + b;
			let x = y.length + (g ? 0 : e.length), S = x + (_ || "文本").length;
			requestAnimationFrame(() => {
				d.focus(), d.selectionStart = x, d.selectionEnd = S;
			}), M();
		}, F = (e) => {
			N((u) => {
				let d = u.trimStart(), f = d.replace(/^#{1,6}\s+/, ""), p = u.length - d.length, m = f || "标题", h = "#".repeat(e) + " ";
				return `${" ".repeat(p)}${h}${m}`;
			});
		}, I = () => {
			N((e) => {
				let u = e.trimStart(), d = e.length - u.length;
				return u ? /^[-*+]\s+/.test(u) ? e : `${" ".repeat(d)}- ${u}` : `${" ".repeat(d)}- `;
			});
		}, L = () => {
			N((e, u) => {
				let d = e.trimStart(), f = e.length - d.length, p = u + 1;
				return d ? /^\d+\.\s+/.test(d) ? e : `${" ".repeat(f)}${p}. ${d}` : `${" ".repeat(f)}${p}. `;
			});
		}, R = () => {
			N((e) => {
				let u = e.trimStart(), d = e.length - u.length;
				return u ? /^>\s+/.test(u) ? e : `${" ".repeat(d)}> ${u}` : `${" ".repeat(d)}> `;
			});
		}, z = () => {
			if (T.readOnly) return;
			let e = O.value;
			if (!e) return;
			let u = D.value, d = e.selectionStart, f = e.selectionEnd, p = u.slice(d, f);
			if (!p) {
				let p = u.slice(0, d), m = u.slice(f);
				D.value = p + "```\n代码\n```" + m;
				let h = p.length + 4, g = h + 2;
				requestAnimationFrame(() => {
					e.focus(), e.selectionStart = h, e.selectionEnd = g;
				}), M();
				return;
			}
			let m = u.slice(0, d), h = u.slice(f);
			D.value = m + `\`\`\`\n${p}\n\`\`\`` + h;
			let g = m.length + 4, _ = g + p.length;
			requestAnimationFrame(() => {
				e.focus(), e.selectionStart = g, e.selectionEnd = _;
			}), M();
		}, B = () => {
			if (T.readOnly) return;
			let e = O.value;
			if (!e) return;
			let u = D.value, d = e.selectionStart, f = e.selectionEnd, p = u.slice(0, d), m = u.slice(f), h = `${p.endsWith("\n") || !p ? "" : "\n"}---${m.startsWith("\n") || !m ? "" : "\n"}`;
			D.value = p + h + m;
			let g = (p + h).length;
			requestAnimationFrame(() => {
				e.focus(), e.selectionStart = g, e.selectionEnd = g;
			}), M();
		}, V = () => {
			if (T.readOnly) return;
			let e = O.value;
			if (!e) return;
			let u = D.value, d = e.selectionStart, f = e.selectionEnd, p = u.slice(d, f) || "链接文本", m = u.slice(0, d), h = u.slice(f);
			D.value = m + `[${p}](https://)` + h;
			let g = (m + `[${p}](`).length, _ = g + 8;
			requestAnimationFrame(() => {
				e.focus(), e.selectionStart = g, e.selectionEnd = _;
			}), M();
		}, H = () => {
			if (T.readOnly) return;
			let e = O.value;
			if (!e) return;
			let u = D.value, d = e.selectionStart, f = e.selectionEnd, p = u.slice(d, f) || "图片描述", m = u.slice(0, d), h = u.slice(f);
			D.value = m + `![${p}](https://)` + h;
			let g = (m + `![${p}](`).length, _ = g + 8;
			requestAnimationFrame(() => {
				e.focus(), e.selectionStart = g, e.selectionEnd = _;
			}), M();
		}, U = (e) => {
			let u = O.value;
			if (u) {
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
					e.preventDefault(), P("**", "**");
					return;
				}
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
					e.preventDefault(), E("save", D.value);
					return;
				}
				if (!T.readOnly && e.key === "Tab") {
					e.preventDefault();
					let d = D.value, f = u.selectionStart, p = u.selectionEnd, m = d.lastIndexOf("\n", f - 1) + 1, h = d.indexOf("\n", p), g = h === -1 ? d.length : h, _ = d.slice(0, m), v = d.slice(m, g), y = d.slice(g);
					if (e.shiftKey) {
						let e = v.split("\n").map((e) => e.startsWith("  ") ? e.slice(2) : e).join("\n");
						D.value = _ + e + y;
						let d = v.length - e.length;
						requestAnimationFrame(() => {
							u.selectionStart = f - d, u.selectionEnd = p - d;
						});
					} else {
						let e = v.split("\n").map((e) => "  " + e).join("\n");
						D.value = _ + e + y;
						let d = e.length - v.length;
						requestAnimationFrame(() => {
							u.selectionStart = f + 2, u.selectionEnd = p + d;
						});
					}
					M();
				}
			}
		}, W = (e) => {
			E("focus", e);
		}, G = (e) => {
			E("blur", e);
		}, K = computed(() => ["markdown-editor", `markdown-editor--${T.theme}`]);
		return (u, g) => (openBlock(), createElementBlock("div", { class: normalizeClass(K.value) }, [C.showToolbar ? (openBlock(), createElementBlock("div", _hoisted_1, [renderSlot(u.$slots, "toolbar", {
			wrapSelection: P,
			toggleHeading: F,
			insertUnorderedList: I,
			insertOrderedList: L,
			insertBlockquote: R,
			insertCodeBlock: z,
			insertHorizontalRule: B,
			insertLink: V,
			insertImage: H
		}, () => [
			C.toolbarItems.includes("h1") ? (openBlock(), createElementBlock("button", {
				key: 0,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: g[0] ||= (e) => F(1),
				title: "一级标题"
			}, " H1 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("h2") ? (openBlock(), createElementBlock("button", {
				key: 1,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: g[1] ||= (e) => F(2),
				title: "二级标题"
			}, " H2 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("bold") ? (openBlock(), createElementBlock("button", {
				key: 2,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: g[2] ||= (e) => P("**", "**"),
				title: "加粗 (Ctrl+B)"
			}, " 加粗 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("italic") ? (openBlock(), createElementBlock("button", {
				key: 3,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: g[3] ||= (e) => P("*", "*"),
				title: "斜体"
			}, " 斜体 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("unordered-list") ? (openBlock(), createElementBlock("button", {
				key: 4,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: I,
				title: "无序列表"
			}, " 无序列表 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("ordered-list") ? (openBlock(), createElementBlock("button", {
				key: 5,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: L,
				title: "有序列表"
			}, " 有序列表 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("blockquote") ? (openBlock(), createElementBlock("button", {
				key: 6,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: R,
				title: "引用"
			}, " 引用 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("code-block") ? (openBlock(), createElementBlock("button", {
				key: 7,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: z,
				title: "代码块"
			}, " 代码块 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("horizontal-rule") ? (openBlock(), createElementBlock("button", {
				key: 8,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: B,
				title: "分割线"
			}, " 分割线 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("link") ? (openBlock(), createElementBlock("button", {
				key: 9,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: V,
				title: "链接 [文本](url)"
			}, " 链接 ")) : createCommentVNode("", !0),
			C.toolbarItems.includes("image") ? (openBlock(), createElementBlock("button", {
				key: 10,
				type: "button",
				class: "markdown-editor__toolbar-button",
				onClick: H,
				title: "图片 ![alt](url)"
			}, " 图片 ")) : createCommentVNode("", !0)
		], !0)])) : createCommentVNode("", !0), createElementVNode("div", _hoisted_2, [createElementVNode("div", _hoisted_3, [createElementVNode("div", _hoisted_4, [C.showLineNumbers ? (openBlock(), createElementBlock("div", _hoisted_5, [(openBlock(!0), createElementBlock(Fragment, null, renderList(A.value, (e, u) => (openBlock(), createElementBlock("div", {
			key: u,
			class: "markdown-editor__line-number"
		}, toDisplayString(u + 1), 1))), 128))])) : createCommentVNode("", !0), withDirectives(createElementVNode("textarea", {
			ref_key: "textareaRef",
			ref: O,
			"onUpdate:modelValue": g[4] ||= (e) => D.value = e,
			class: "markdown-editor__textarea",
			spellcheck: "false",
			readonly: C.readOnly,
			placeholder: C.placeholder,
			onInput: M,
			onKeydown: U,
			onFocus: W,
			onBlur: G
		}, null, 40, _hoisted_6), [[vModelText, D.value]])])]), C.showPreview ? (openBlock(), createElementBlock("div", _hoisted_7, [renderSlot(u.$slots, "preview", { html: k.value }, () => [createElementVNode("div", {
			class: "markdown-editor__preview",
			innerHTML: k.value
		}, null, 8, _hoisted_8)], !0)])) : createCommentVNode("", !0)])], 2));
	}
}, [["__scopeId", "data-v-1cc521b6"]]), lib_default = MarkdownEditor_default;
export { MarkdownEditor_default as MarkdownEditor, lib_default as default };
