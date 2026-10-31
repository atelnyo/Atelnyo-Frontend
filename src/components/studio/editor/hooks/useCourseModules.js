/**
 * useCourseModules — syllabus module list operations.
 *
 * Modules live inside `form.modules`; this hook is the ONLY writer
 * besides the form setter itself (add / remove / move / drag-drop
 * reorder / copy blocks between modules). Every mutation marks dirty.
 */
import { useCallback, useRef, useState } from 'react';

export function useCourseModules({ form, setForm, selected, setSelected, markDirty }) {
  const handleModuleChange = useCallback((index, field, value) => {
    setForm((f) => {
      const modules = f.modules.map((m, i) => (i === index ? { ...m, [field]: value } : m));
      return { ...f, modules };
    });
    markDirty();
  }, [setForm, markDirty]);

  const handleModuleBlocksChange = useCallback((index, blocks) => {
    setForm((f) => {
      const modules = f.modules.map((m, i) => (i === index ? { ...m, blocks } : m));
      return { ...f, modules };
    });
    markDirty();
  }, [setForm, markDirty]);

  const addModule = useCallback(() => {
    setForm((f) => ({ ...f, modules: [...f.modules, { title: '', description: '' }] }));
    setSelected(form.modules.length);
    markDirty();
  }, [form.modules.length, setForm, setSelected, markDirty]);

  const removeModule = useCallback((index) => {
    setForm((f) => ({ ...f, modules: f.modules.filter((_, i) => i !== index) }));
    setSelected((cur) => (cur === index ? null : (cur > index ? cur - 1 : cur)));
    markDirty();
  }, [setForm, setSelected, markDirty]);

  const moveModule = useCallback((index, dir) => {
    setForm((f) => {
      const modules = [...f.modules];
      const target = index + dir;
      if (target < 0 || target >= modules.length) return f;
      [modules[index], modules[target]] = [modules[target], modules[index]];
      return { ...f, modules };
    });
    setSelected((cur) => (cur === index ? index + dir : cur));
    markDirty();
  }, [setForm, setSelected, markDirty]);

  // ─── HTML5 drag-and-drop module reordering (chevrons stay) ─────────
  const dragModuleRef = useRef(null);
  const [dragOverModule, setDragOverModule] = useState(null);
  const dropModule = useCallback((target) => {
    const src = dragModuleRef.current;
    dragModuleRef.current = null;
    setDragOverModule(null);
    if (src == null || src === target) return;
    setForm((f) => {
      const modules = [...f.modules];
      const [moved] = modules.splice(src, 1);
      modules.splice(target, 0, moved);
      return { ...f, modules };
    });
    setSelected((cur) => {
      if (cur == null) return cur;
      if (cur === src) return target;
      if (src < cur && target >= cur) return cur - 1;
      if (src > cur && target <= cur) return cur + 1;
      return cur;
    });
    markDirty();
  }, [setForm, setSelected, markDirty]);

  // ─── Copy a module's blocks into another module (reuse structure,
  //     fresh block ids) — the fastest way to build a variation. ─────
  const [copyFrom, setCopyFrom] = useState(null);
  const copyBlocksToModule = useCallback((target) => {
    if (copyFrom == null || copyFrom === target) return;
    const src = form.modules[copyFrom]?.blocks || [];
    if (src.length === 0) return;
    setForm((f) => ({
      ...f,
      modules: f.modules.map((m, i) => (i === target
        ? { ...m, blocks: [...(m.blocks || []), ...src.map((b) => ({ ...b, id: `${b.type}-${Date.now()}-copy` }))] }
        : m)),
    }));
    setCopyFrom(null);
    markDirty();
  }, [copyFrom, form.modules, setForm, markDirty]);

  return {
    handleModuleChange,
    handleModuleBlocksChange,
    addModule,
    removeModule,
    moveModule,
    dragModuleRef,
    dragOverModule, setDragOverModule,
    dropModule,
    copyFrom, setCopyFrom,
    copyBlocksToModule,
  };
}
