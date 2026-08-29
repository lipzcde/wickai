import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Cpu, Edit3, Check, Sparkles } from 'lucide-react';

interface ModelSelectorProps {
  currentModel: string;
  onSelectModel: (model: string) => void;
  disabled?: boolean;
}

const PRESET_MODELS = [
  { id: 'kirocor', name: 'kirocor', desc: 'Default primary model' },
  { id: 'llama-3.3-70b-instruct', name: 'llama-3.3-70b-instruct', desc: 'High capability open model' },
  { id: 'gpt-4o-mini', name: 'gpt-4o-mini', desc: 'Lightweight efficient reasoning' },
  { id: 'deepseek-r1', name: 'deepseek-r1', desc: 'Deep reasoning engine' },
];

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  currentModel,
  onSelectModel,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customInput, setCustomInput] = useState(currentModel);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCustomInput(currentModel);
  }, [currentModel]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsEditingCustom(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectModel(customInput.trim());
      setIsEditingCustom(false);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef} id="model-selector-container">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-[#7A7066]">Model:</span>
        <button
          id="model-selector-button"
          type="button"
          disabled={disabled}
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-[#E5E1DA] bg-[#F7F5F0] hover:bg-[#F0EDE4] text-[#2A2624] text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#C05621]"></span>
          <span className="font-medium text-[#2A2624]">{currentModel}</span>
          <ChevronDown className="w-3 h-3 text-[#7A7066] transition-transform duration-200" />
        </button>
      </div>

      {isOpen && (
        <div
          id="model-selector-dropdown"
          className="absolute left-0 mt-1.5 w-72 origin-top-left rounded border border-[#E5E1DA] bg-[#FDFCF9] p-2 shadow-md z-50 focus:outline-none animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="px-2 py-1 text-[10px] font-semibold text-[#7A7066] uppercase tracking-wider border-b border-[#E5E1DA] flex items-center justify-between">
            <span>Select Model</span>
            <span className="text-[9px] font-mono lowercase text-[#C05621]">OpenAI Compatible</span>
          </div>

          <div className="py-1 space-y-0.5">
            {PRESET_MODELS.map((preset) => {
              const isSelected = currentModel === preset.id;
              return (
                <button
                  key={preset.id}
                  id={`model-option-${preset.id}`}
                  type="button"
                  onClick={() => {
                    onSelectModel(preset.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded text-xs flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-[#F0EDE4] text-[#8B4513] font-semibold'
                      : 'text-[#2A2624] hover:bg-[#F7F5F0]'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-mono font-medium">{preset.name}</span>
                    <span className="text-[10px] text-[#7A7066]">{preset.desc}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-[#C05621] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="mt-1 pt-1.5 border-t border-[#E5E1DA]">
            {!isEditingCustom ? (
              <button
                id="model-custom-toggle-button"
                type="button"
                onClick={() => setIsEditingCustom(true)}
                className="w-full text-left px-2.5 py-1.5 rounded text-xs text-[#C05621] hover:bg-[#F7F5F0] flex items-center gap-1.5 font-medium transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Custom model name...</span>
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="p-1 space-y-1.5">
                <div className="text-[10px] font-medium text-[#7A7066]">Custom Model Identifier</div>
                <div className="flex items-center gap-1">
                  <input
                    id="model-custom-input"
                    type="text"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="e.g. claude-3-5-sonnet"
                    className="flex-1 px-2 py-1 text-xs font-mono bg-[#FDFCF9] border border-[#E5E1DA] rounded focus:outline-none focus:border-[#C05621] text-[#2A2624]"
                    autoFocus
                  />
                  <button
                    id="model-custom-apply-button"
                    type="submit"
                    className="px-2.5 py-1 text-xs bg-[#C05621] text-white rounded hover:bg-[#8B4513] font-medium transition-colors cursor-pointer"
                  >
                    Set
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
