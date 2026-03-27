"use client";

export function Sidebar() {
    return (
        <aside className="fixed left-0 top-0 h-screen w-64 bg-[#181818] border-r border-transparent flex flex-col p-6 hidden lg:flex">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-10 px-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center">
                    <span className="font-bold text-white">C</span>
                </div>
                <span className="text-xl font-bold text-purple-400">Cofeed</span>
            </div>

            <div className="flex-1 flex flex-col justify-between">
                <div>
                    {/* Simplified Menu - Just Dashboard for now or empty */}
                </div>

                <div className="px-2">
                    <p className="text-zinc-600 text-xs text-center">
                        Sistema de Gestión <br /> V 1.2
                    </p>
                </div>
            </div>
        </aside>
    );
}
