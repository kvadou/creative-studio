import { useState, useEffect, useRef, useCallback } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { getChessBooks, type ChessBook } from '../../lib/api';

interface BookSearchProps {
  value: string;
  onChange: (bookId: string, book: ChessBook | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function BookSearch({
  value,
  onChange,
  placeholder = "Search for a chess book...",
  disabled = false,
}: BookSearchProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [allBooks, setAllBooks] = useState<ChessBook[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<ChessBook[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedBook, setSelectedBook] = useState<ChessBook | null>(null);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load all books on mount
  useEffect(() => {
    async function loadBooks() {
      try {
        const books = await getChessBooks();
        setAllBooks(books);
        // If we have a value, find the selected book
        if (value) {
          const book = books.find(b => b.id === value);
          if (book) {
            setSelectedBook(book);
            setSearchTerm(book.title);
          }
        }
      } catch (error) {
        console.error('Failed to load books:', error);
      } finally {
        setLoading(false);
      }
    }
    loadBooks();
  }, []);

  // Filter books based on search term
  const filterBooks = useCallback((term: string) => {
    if (!term) {
      setFilteredBooks(allBooks.slice(0, 10));
      return;
    }
    const lower = term.toLowerCase();
    const filtered = allBooks.filter(book =>
      book.title.toLowerCase().includes(lower) ||
      book.author.toLowerCase().includes(lower) ||
      book.concepts.some(c => c.toLowerCase().includes(lower))
    );
    setFilteredBooks(filtered.slice(0, 10));
  }, [allBooks]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    filterBooks(newValue);
    setShowDropdown(true);

    // Clear selection if user edits
    if (selectedBook) {
      setSelectedBook(null);
      onChange('', null);
    }
  };

  // Handle book selection
  const handleSelectBook = (book: ChessBook) => {
    setSearchTerm(book.title);
    setSelectedBook(book);
    onChange(book.id, book);
    setShowDropdown(false);
  };

  // Handle clear
  const handleClear = () => {
    setSearchTerm('');
    setSelectedBook(null);
    onChange('', null);
    setFilteredBooks(allBooks.slice(0, 10));
    inputRef.current?.focus();
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize filtered books when all books load
  useEffect(() => {
    if (allBooks.length > 0 && filteredBooks.length === 0) {
      setFilteredBooks(allBooks.slice(0, 10));
    }
  }, [allBooks]);

  return (
    <div className="relative">
      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => {
            filterBooks(searchTerm);
            setShowDropdown(true);
          }}
          placeholder={loading ? "Loading books..." : placeholder}
          disabled={disabled || loading}
          className="w-full px-4 py-2 pr-10 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-stc-purple-100 focus:border-stc-purple-500 disabled:bg-neutral-100"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && filteredBooks.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filteredBooks.map((book) => (
            <button
              key={book.id}
              type="button"
              onClick={() => handleSelectBook(book)}
              className="w-full text-left px-4 py-2 hover:bg-stc-purple-50 border-b border-neutral-100 last:border-b-0"
            >
              <div className="font-medium text-sm">{book.title}</div>
              <div className="text-xs text-neutral-500">
                {book.author} ({book.year})
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Book Card */}
      {selectedBook && (
        <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-stc-orange/20">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-bold text-neutral-900">{selectedBook.title}</div>
              <div className="text-sm text-stc-orange">
                by {selectedBook.author} ({selectedBook.year})
              </div>
            </div>
            <span className="text-2xl">📚</span>
          </div>
          <p className="text-xs text-neutral-600 mt-2">{selectedBook.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {selectedBook.concepts.slice(0, 4).map(concept => (
              <span
                key={concept}
                className="text-xs px-2 py-0.5 bg-stc-orange/15 text-stc-orange rounded-full"
              >
                {concept}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookSearch;
