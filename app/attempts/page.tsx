"use client"

import React, { useState, useEffect } from "react"
import { useAuth } from "@/features/auth/services/authService"
import { getUserAttempts, deleteAttempt } from "@/features/attempts/services/attemptService"
import { AttemptCard } from "@/features/attempts/components/attempt-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, Filter, Home } from "lucide-react"
import Link from "next/link"
import type { Attempt } from "@/features/attempts/models/attempt"
import { cases } from "@/features/case-selection/data/card-data"

// Temporary UI components until we create the actual ones
const Select = ({ children, value, onValueChange }: { children: React.ReactNode, value: string, onValueChange: (value: string) => void }) => {
  const options = React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && child.type === SelectItem
  );
  
  return (
    <div className="relative">
      <div className="flex items-center p-2 border rounded-md bg-background">
        <Filter className="mr-2 h-4 w-4" />
        <span>{value === 'all' ? 'All Statuses' : 
               value === 'completed' ? 'Completed' : 
               value === 'in_progress' ? 'In Progress' : 
               value === 'abandoned' ? 'Abandoned' : 'Filter by status'}</span>
      </div>
      <select 
        value={value} 
        onChange={(e) => onValueChange(e.target.value)}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {options}
      </select>
    </div>
  );
};
const SelectItem = ({ value, children }: { value: string, children: React.ReactNode }) => <option value={value}>{children}</option>;

export default function AttemptsPage() {
  const { user, loading: authLoading } = useAuth()
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [filteredAttempts, setFilteredAttempts] = useState<Attempt[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const attemptsPerPage = 9 // 3x3 grid on desktop
  
  useEffect(() => {
    const loadAttempts = async () => {
      if (!user) return
      
      setIsLoading(true)
      const userAttempts = await getUserAttempts()
      setAttempts(userAttempts)
      setFilteredAttempts(userAttempts)
      setIsLoading(false)
    }
    
    loadAttempts()
  }, [user])
  
  useEffect(() => {
    // Apply filters
    let filtered = [...attempts]
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(attempt => 
        attempt.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cases.find((c: { id: string, title: string }) => c.id === attempt.caseId)?.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(attempt => 
        attempt.completionStatus === statusFilter
      )
    }
    
    setFilteredAttempts(filtered)
    setCurrentPage(1) // Reset to first page when filters change
  }, [attempts, searchQuery, statusFilter])
  
  const handleDeleteAttempt = async (attemptId: string) => {
    const success = await deleteAttempt(attemptId)
    
    if (success) {
      setAttempts(prev => prev.filter(a => a.id !== attemptId))
    }
  }
  
  // Pagination logic
  const indexOfLastAttempt = currentPage * attemptsPerPage
  const indexOfFirstAttempt = indexOfLastAttempt - attemptsPerPage
  const currentAttempts = filteredAttempts.slice(indexOfFirstAttempt, indexOfLastAttempt)
  const totalPages = Math.ceil(filteredAttempts.length / attemptsPerPage)
  
  const paginate = (pageNumber: number) => setCurrentPage(pageNumber)
  
  return (
    <div className="container mx-auto px-4 py-8">
      <header className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary md:text-4xl">
            My Attempts
          </h1>
          <p className="mt-2 text-muted-foreground">
            View and manage your past case attempts
          </p>
        </div>
        <Link href="/">
          <Button variant="outline" className="flex items-center gap-2 whitespace-nowrap">
            <Home className="h-4 w-4" />
            Browse Cases
          </Button>
        </Link>
      </header>
      
      {/* Filters */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search attempts..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="w-full sm:w-48">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="abandoned">Abandoned</SelectItem>
          </Select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
          <span>Loading attempts...</span>
        </div>
      ) : filteredAttempts.length > 0 ? (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {currentAttempts.map((attempt) => (
              <AttemptCard
                key={attempt.id}
                attempt={attempt}
                onDelete={() => handleDeleteAttempt(attempt.id)}
              />
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center mt-8">
              <nav className="flex space-x-2" aria-label="Pagination">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => paginate(page)}
                    className="w-10 h-10"
                  >
                    {page}
                  </Button>
                ))}
              </nav>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12 border rounded-lg">
          <p className="text-lg mb-4">No attempts found</p>
          <p className="text-muted-foreground mb-6">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your filters"
              : "Use the 'Browse Cases' button above to start a new case"}
          </p>
        </div>
      )}
    </div>
  )
}
