import { Droplet, Check } from 'lucide-react'

export const TajiCheckLogo = () => (
  <div className="flex items-center gap-2">
    <div className="relative">
      <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-teal-700 rounded-xl flex items-center justify-center shadow-lg shadow-teal-500/30 border border-teal-400/30">
        <Droplet className="text-white fill-white" size={18} />
      </div>
      <div className="absolute -bottom-1 -right-1 bg-slate-900 p-0.5 rounded-full border border-slate-800">
        <div className="bg-white rounded-full p-0.5 flex items-center justify-center w-3.5 h-3.5">
          <Check size={10} className="text-teal-600 stroke-[4]" />
        </div>
      </div>
    </div>
    <div className="flex flex-col justify-center">
      <span className="text-2xl font-black tracking-tighter text-white leading-none">
        Taji<span className="text-teal-500">Check</span>
      </span>
    </div>
  </div>
)
