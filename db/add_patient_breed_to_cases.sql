-- Add patient_breed column to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS patient_breed text;
