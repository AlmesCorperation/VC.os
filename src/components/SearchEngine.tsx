import React, { useState, useRef, useEffect } from 'react';
import { Search, Globe, ArrowLeft, ArrowRight, RotateCw, ExternalLink, Shield } from 'lucide-react';
import { kernel } from '../services/kernel';

interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export const SearchEngine: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [useProxy, setUseProxy] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    // Check if query is a URL
    if (query.startsWith('http://') || query.startsWith('https://')) {
      setActiveUrl(query);
      kernel.emitEvent('TASK', `BROWSER_NAV: ${query}`);
      kernel.executeTask('BROWSER_RENDER', 10);
      return;
    }

    setActiveUrl(null);
    setLoading(true);
    setError(null);
    kernel.emitEvent('TASK', `BROWSER_SEARCH: ${query}`);
    kernel.executeTask('BROWSER_REQ', 5);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || data.error);
      }

      const items = data.items || [];
      setResults(items.map((item: any) => ({
        title: item.title,
        link: item.link,
        snippet: item.snippet
      })));
      setHistory(prev => [query, ...prev.slice(0, 9)]);
    } catch (err: any) {
      setError(err.message || "Failed to connect to the internet.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openWebsite = (url: string) => {
    setActiveUrl(url);
    setQuery(url);
  };

  const goBack = () => {
    setActiveUrl(null);
    // Restore the last search query if we were on a search page
    if (history.length > 0) {
      setQuery(history[0]);
    }
  };

  const getIframeSrc = () => {
    if (!activeUrl) return '';
    if (useProxy) {
      return `/api/proxy?url=${encodeURIComponent(activeUrl)}`;
    }
    return activeUrl;
  };

  return (
    <div className={`h-full flex flex-col font-sans text-[12px] ${useProxy ? 'bg-[#1a1a1a] text-green-400' : 'bg-win95-gray'}`}>
      {/* Browser Toolbar */}
      <div className={`p-1 border-b flex flex-col gap-1 ${useProxy ? 'border-green-900/30' : 'border-win95-dark-gray'}`}>
        <div className="flex items-center gap-1">
          <button 
            className={`p-1 border-outset hover:bg-zinc-200 active:border-inset disabled:opacity-50 ${useProxy ? 'bg-[#222] border-green-900/50 text-green-400' : ''}`} 
            disabled={!activeUrl}
            onClick={goBack}
          >
            <ArrowLeft size={14} />
          </button>
          <button className={`p-1 border-outset hover:bg-zinc-200 active:border-inset disabled:opacity-50 ${useProxy ? 'bg-[#222] border-green-900/50 text-green-400' : ''}`} disabled>
            <ArrowRight size={14} />
          </button>
          <button className={`p-1 border-outset hover:bg-zinc-200 active:border-inset ${useProxy ? 'bg-[#222] border-green-900/50 text-green-400' : ''}`} onClick={() => activeUrl ? setActiveUrl(activeUrl) : handleSearch()}>
            <RotateCw size={14} />
          </button>
          <div className={`flex-1 flex items-center border-inset px-2 py-1 gap-2 ml-1 ${useProxy ? 'bg-black border-green-900/50' : 'bg-white'}`}>
            <Globe size={14} className={useProxy ? 'text-green-500' : 'text-blue-600'} />
            <form onSubmit={handleSearch} className="flex-1">
              <input 
                type="text" 
                className={`w-full outline-none bg-transparent ${useProxy ? 'text-green-400 font-mono' : ''}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the World Wide Web..."
              />
            </form>
          </div>
          <button 
            className={`px-3 py-1 border-outset font-bold flex items-center gap-1 hover:bg-zinc-200 active:border-inset ${useProxy ? 'bg-[#222] border-green-900/50 text-green-400' : 'bg-win95-gray'}`}
            onClick={() => handleSearch()}
          >
            <Search size={14} />
            Go
          </button>
          <button 
            onClick={() => setUseProxy(!useProxy)}
            className={`px-2 py-1 border-outset text-[9px] font-bold flex items-center gap-1 ${useProxy ? 'bg-green-600 text-black border-green-400' : 'bg-win95-gray text-gray-500'}`}
          >
            <Shield size={10} />
            {useProxy ? 'PROXY_ON' : 'PROXY_OFF'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className={`flex-1 border-inset m-1 overflow-hidden relative ${useProxy ? 'bg-black border-green-900/50' : 'bg-white'}`} ref={scrollRef}>
        {activeUrl ? (
          <div className="w-full h-full flex flex-col">
            <div className={`border-b p-1 text-[10px] flex items-center justify-between ${useProxy ? 'bg-green-900/20 border-green-900/30 text-green-400' : 'bg-yellow-50 text-yellow-800'}`}>
              <span>{useProxy ? 'TUNNELING THROUGH VC_PROXY_v1.0' : 'Note: Some websites may block embedding for security reasons.'}</span>
              <button 
                onClick={() => window.open(activeUrl, '_blank')}
                className="hover:underline flex items-center gap-1"
              >
                Open in new tab <ExternalLink size={10} />
              </button>
            </div>
            <iframe 
              src={getIframeSrc()} 
              className="w-full flex-1 border-none bg-white"
              title="Browser View"
            />
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-win95-dark-gray">
            <div className="w-8 h-8 border-4 border-win95-blue border-t-transparent rounded-full animate-spin" />
            <p className="font-bold animate-pulse">CONNECTING TO GLOBAL_NET...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-red-600">
            <div className="p-4 bg-red-50 border border-red-200 rounded">
              <p className="font-bold">DNS_ERROR: {error}</p>
              <p className="text-[10px] mt-1">Please check your system configuration or environment variables.</p>
            </div>
          </div>
        ) : results.length > 0 ? (
          <div className="h-full overflow-y-auto p-4">
            <div className="space-y-6 max-w-2xl mx-auto">
              <div className="border-b pb-2 mb-4">
                <p className="text-win95-dark-gray text-[10px]">About {results.length} results found for "{query}"</p>
              </div>
              {results.map((res, i) => (
                <div key={i} className="group">
                  <button 
                    onClick={() => openWebsite(res.link)}
                    className="text-blue-700 hover:underline text-lg font-medium flex items-center gap-2 text-left"
                  >
                    {res.title}
                    <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                  <p className="text-green-700 text-[11px] truncate mb-1">{res.link}</p>
                  <p className="text-zinc-600 leading-relaxed">{res.snippet}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center gap-4">
            <div className="w-24 h-24 bg-win95-blue/10 rounded-full flex items-center justify-center">
              <Globe size={48} className="text-win95-blue opacity-20" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-win95-blue">VC_EXPLORER</h2>
              <p className="text-win95-dark-gray mt-1">Enter a query above to search the internet.</p>
            </div>
            {history.length > 0 && (
              <div className="mt-8 text-left w-full max-w-xs">
                <p className="font-bold text-[10px] uppercase opacity-50 mb-2">Recent Searches</p>
                <div className="flex flex-wrap gap-2">
                  {history.map((h, i) => (
                    <button 
                      key={i} 
                      className="px-2 py-1 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 text-[10px] rounded"
                      onClick={() => {
                        setQuery(h);
                        handleSearch();
                      }}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-win95-gray border-t border-win95-dark-gray px-2 py-0.5 flex justify-between text-[10px] text-win95-dark-gray">
        <span>{loading ? "Opening page..." : results.length > 0 ? "Done" : "Ready"}</span>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${loading ? "bg-yellow-500" : "bg-green-500"}`} />
            {loading ? "TRANSFERRING" : "CONNECTED"}
          </span>
          <span className="border-l border-win95-dark-gray pl-2">Internet Zone</span>
        </div>
      </div>
    </div>
  );
};
