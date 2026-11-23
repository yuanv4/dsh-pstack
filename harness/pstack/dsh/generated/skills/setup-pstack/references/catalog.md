# DSH model catalog

`pstack_catalog` and the role editor use the same directory. They enumerate the models returned by `ctx.llm.listModels()` for each registered provider. pstack does not check API keys, provider prefixes, or OAuth files. The adapter handles authentication when a model is called.

`resolveModelInfo()` supplies supported reasoning efforts when available. If it returns no effort metadata, leave effort unset.

`pstack_overlay_write` validates the provider, model, and any explicit effort against that directory before saving `$DSH_HOME/pstack-dsh.json`. `pstack_spawn` also validates explicit models and efforts. A provider adapter id is not necessarily the model vendor, so it cannot by itself establish vendor diversity.
