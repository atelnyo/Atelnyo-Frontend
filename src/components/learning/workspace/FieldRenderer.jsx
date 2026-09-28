/**
 * src/components/learning/workspace/FieldRenderer.jsx
 *
 * §6 — Extensible field type registry. Renders the appropriate
 * input for each field type with proper validation.
 *
 * §7 — Clearly separates project instructions from student work.
 *
 * §21 — Validation should support learning, not frustrate students.
 * Do not overvalidate creative student work.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../services/api';

/**
 * §17 — Debounced autosave: changes update memory immediately,
 * then persist to server after a short delay.
 */
function useDebouncedSave(callback, delay = 800) {
  const timeoutRef = useRef(null);
  const pendingRef = useRef(null);

  const trigger = useCallback((...args) => {
    pendingRef.current = args;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (pendingRef.current) {
        callback(...pendingRef.current);
        pendingRef.current = null;
      }
    }, delay);
  }, [callback, delay]);

  // Flush on unmount
  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (pendingRef.current) {
      callback(...pendingRef.current);
    }
  }, []);

  return trigger;
}

export default function FieldRenderer({ field, onSave, isHt }) {
  const [localValue, setLocalValue] = useState(() => {
    if (field.field_type === 'number' || field.field_type === 'currency') {
      return field.value_number != null ? String(field.value_number) : '';
    }
    if (field.field_type === 'date') {
      return field.value_date || '';
    }
    return field.value_text || '';
  });

  const debouncedSave = useDebouncedSave((text, num, date, json) => {
    onSave(text, num, date, json);
  });

  const handleChange = useCallback((newValue) => {
    setLocalValue(newValue);
    // §10 — Save the appropriate value based on field type
    const ft = field.field_type;
    if (ft === 'number' || ft === 'currency') {
      const numVal = newValue === '' ? null : Number(newValue);
      debouncedSave('', numVal, null, null);
    } else if (ft === 'date') {
      debouncedSave('', null, newValue || null, null);
    } else if (ft === 'select') {
      debouncedSave(newValue, null, null, null);
    } else if (ft === 'multi_select') {
      debouncedSave('', null, null, newValue);
    } else if (ft === 'checklist') {
      debouncedSave('', null, null, newValue);
    } else {
      debouncedSave(newValue, null, null, null);
    }
  }, [field.field_type, debouncedSave]);

  const { key, label, field_type, placeholder, help_text, required_status, validation_rules, options } = field;
  const isRequired = required_status === 'required';
  const fieldId = `pw-field-${key}`;

  // Validation state
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');

  const validate = useCallback((value) => {
    if (isRequired && !value && value !== 0) {
      return isHt ? 'Chanp sa a obligatwa.' : 'This field is required.';
    }
    if (value && validation_rules?.minLength && String(value).length < validation_rules.minLength) {
      return isHt
        ? `Tèks la twò kout (min: ${validation_rules.minLength} karaktè).`
        : `Text is too short (min: ${validation_rules.minLength} characters).`;
    }
    if (value && validation_rules?.maxLength && String(value).length > validation_rules.maxLength) {
      return isHt
        ? `Tèks la twò long (max: ${validation_rules.maxLength} karaktè).`
        : `Text is too long (max: ${validation_rules.maxLength} characters).`;
    }
    if (value && validation_rules?.pattern && !new RegExp(validation_rules.pattern).test(String(value))) {
      return isHt ? 'Fòma a pa kòrèk.' : 'Invalid format.';
    }
    return '';
  }, [isRequired, validation_rules, isHt]);

  useEffect(() => {
    if (touched) {
      setError(validate(localValue));
    }
  }, [touched, localValue, validate]);

  const helpId = help_text ? `${fieldId}-help` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`pw-field ${error ? 'pw-field--error' : ''} ${isRequired ? 'pw-field--required' : ''}`}>
      <label className="pw-field-label" htmlFor={fieldId}>
        {label}
        {isRequired && <span className="pw-field-required" aria-hidden="true">*</span>}
        {required_status === 'recommended' && (
          <span className="pw-field-recommended">{isHt ? '(rekomande)' : '(recommended)'}</span>
        )}
      </label>

      {help_text && (
        <p className="pw-field-help" id={helpId}>{help_text}</p>
      )}

      {renderInput(fieldId, field_type, localValue, handleChange, setTouched, placeholder, options, isHt, validation_rules, isRequired, describedBy)}

      {error && <p className="pw-field-error" id={errorId} role="alert">{error}</p>}
    </div>
  );
}

// ─── File Upload (image_ref / video_ref / document_ref) ────────────
const FILE_ACCEPT = {
  image_ref: 'image/jpeg,image/png,image/webp,image/gif',
  video_ref: 'video/mp4,video/webm,video/quicktime',
  document_ref: 'application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx',
};
const FILE_ICONS = {
  image_ref: 'fa-image',
  video_ref: 'fa-video',
  document_ref: 'fa-file-alt',
};
const FILE_MAX_MB = 50;

function FileUploadField({ id, field_type, value, onChange, onBlur, placeholder, isHt }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const accept = FILE_ACCEPT[field_type] || '*';
  const icon = FILE_ICONS[field_type] || 'fa-file';
  const kindMap = { image_ref: 'image', video_ref: 'video', document_ref: 'document' };
  const kind = kindMap[field_type] || 'document';

  const handleUpload = useCallback(async (file) => {
    if (!file) return;
    if (file.size > FILE_MAX_MB * 1024 * 1024) {
      setUploadError(isHt ? `Fichye a twò gwo (maks ${FILE_MAX_MB}MB)` : `File too large (max ${FILE_MAX_MB}MB)`);
      return;
    }
    setUploading(true);
    setUploadProgress(0);
    setUploadError('');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const res = await api.post('media/upload/', {
            file: reader.result,
            kind,
            filename: file.name,
          }, {
            onUploadProgress: (e) => {
              if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
            },
          });
          const url = res.data?.url;
          if (url) {
            onChange(url);
          } else {
            throw new Error('No URL returned');
          }
        } catch (err) {
          console.error('[FileUpload] upload failed:', err);
          setUploadError(isHt ? 'Erè pandan telechajman.' : 'Upload failed.');
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[FileUpload] read error:', err);
      setUploading(false);
    }
  }, [onChange, kind, isHt]);

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  }, [handleUpload]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  }, [handleUpload]);

  const getFileName = (url) => {
    if (!url) return '';
    try {
      const parts = url.split('/');
      const last = parts[parts.length - 1].split('?')[0];
      return decodeURIComponent(last) || url;
    } catch { return url; }
  };

  return (
    <div className={`pw-file-upload ${dragOver ? 'pw-file-upload--drag' : ''}`}>
      {/* URL input */}
      <div className="pw-file-upload-row">
        <input
          id={id}
          type="url"
          className="pw-input"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || 'https://...'}
          disabled={uploading}
        />
        <button
          type="button"
          className="pw-btn pw-btn--secondary pw-file-upload-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <i className="fas fa-spinner fa-spin" aria-hidden="true" />
          ) : (
            <i className="fas fa-cloud-arrow-up" aria-hidden="true" />
          )}
          <span>{isHt ? 'Telechaje' : 'Upload'}</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {/* Progress bar — Phase 10: accessible with text */}
      {uploading && uploadProgress > 0 && (
        <div className="pw-file-progress">
          <div
            className="pw-file-progress-bar"
            role="progressbar"
            aria-valuenow={uploadProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={isHt ? `Ap telechaje: ${uploadProgress}%` : `Uploading: ${uploadProgress}%`}
            style={{ width: `${uploadProgress}%` }}
          />
          <span className="pw-file-progress-text" aria-hidden="true">{uploadProgress}%</span>
        </div>
      )}

      {/* Preview */}
      {value && !uploading && (
        <div className="pw-file-preview">
          {field_type === 'image_ref' && (
            <img src={value} alt="" className="pw-file-preview-img"
              onError={(e) => { e.target.style.display = 'none'; }} />
          )}
          {field_type === 'video_ref' && value.includes('.mp4') && (
            <video src={value} className="pw-file-preview-video" controls preload="metadata" />
          )}
          {field_type === 'video_ref' && !value.includes('.mp4') && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="pw-file-preview-link">
              <i className="fas fa-external-link-alt" aria-hidden="true" />{' '}
              {getFileName(value) || value}
            </a>
          )}
          {field_type === 'document_ref' && (
            <a href={value} target="_blank" rel="noopener noreferrer" className="pw-file-preview-link">
              <i className="fas fa-file-alt" aria-hidden="true" />{' '}
              {getFileName(value) || value}
            </a>
          )}
        </div>
      )}

      {/* Drag overlay */}
      {dragOver && (
        <div className="pw-file-drag-overlay">
          <i className="fas fa-cloud-arrow-up" aria-hidden="true" />
          <span>{isHt ? 'Depoze fichye a isit la' : 'Drop file here'}</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        className="pw-file-dropzone"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <i className={`fas ${icon}`} aria-hidden="true" />
        <span>
          {isHt
            ? 'Depoze fichye a isit la oswa klike pou chwazi'
            : 'Drop file here or click to browse'}
        </span>
      </div>

      {uploadError && (
        <p className="pw-field-error" role="alert">{uploadError}</p>
      )}
    </div>
  );
}

function renderInput(id, type, value, onChange, onBlur, placeholder, options, isHt, validationRules, isRequired, describedBy) {
  switch (type) {
    case 'long_text':
      return (
        <textarea
          id={id}
          className="pw-input pw-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || (isHt ? 'Ekri isit la...' : 'Write here...')}
          rows={6}
          maxLength={10000}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        />
      );

    case 'short_text':
      return (
        <input
          id={id}
          type="text"
          className="pw-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || (isHt ? 'Ekri isit la...' : 'Write here...')}
          maxLength={500}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        />
      );

    case 'number':
    case 'currency':
      return (
        <input
          id={id}
          type="number"
          className="pw-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || (isHt ? 'Antre yon nimewo...' : 'Enter a number...')}
          min={validationRules?.min}
          max={validationRules?.max}
          step={type === 'currency' ? '0.01' : '1'}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        />
      );

    case 'date':
      return (
        <input
          id={id}
          type="date"
          className="pw-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        />
      );

    case 'select':
      return (
        <select
          id={id}
          className="pw-input pw-select"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        >
          <option value="">{placeholder || (isHt ? 'Chwazi...' : 'Select...')}</option>
          {(options || []).map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      );

    case 'multi_select': {
      const selected = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
      return (
        <div className="pw-multi-select">
          {(options || []).map((opt) => {
            const optVal = opt.value || opt;
            const isChecked = selected.includes(optVal);
            return (
              <label key={optVal} className={`pw-checkbox ${isChecked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const next = isChecked
                      ? selected.filter((v) => v !== optVal)
                      : [...selected, optVal];
                    onChange(next);
                  }}
                />
                <span>{opt.label || opt}</span>
              </label>
            );
          })}
        </div>
      );
    }

    case 'checklist': {
      const items = typeof value === 'string' ? JSON.parse(value || '[]') : (value || []);
      return (
        <div className="pw-checklist">
          {items.map((item, i) => (
            <label key={i} className={`pw-checkbox ${item.checked ? 'is-checked' : ''}`}>
              <input
                type="checkbox"
                checked={item.checked || false}
                onChange={() => {
                  const next = items.map((it, j) =>
                    j === i ? { ...it, checked: !it.checked } : it
                  );
                  onChange(next);
                }}
              />
              <span>{item.text || item}</span>
            </label>
          ))}
        </div>
      );
    }

    case 'url':
      return (
        <input
          id={id}
          type="url"
          className="pw-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || 'https://...'}
          aria-required={isRequired || undefined}
          aria-describedby={describedBy}
        />
      );

    case 'image_ref':
    case 'video_ref':
    case 'document_ref':
      return (
        <FileUploadField
          id={id}
          field_type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          isHt={isHt}
        />
      );

    case 'table':
      return (
        <textarea
          id={id}
          className="pw-input pw-textarea pw-table-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || (isHt ? 'Ekri tablo a isit la...' : 'Enter table data here...')}
          rows={8}
        />
      );

    default:
      return (
        <textarea
          id={id}
          className="pw-input pw-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder || (isHt ? 'Ekri isit la...' : 'Write here...')}
          rows={4}
        />
      );
  }
}
