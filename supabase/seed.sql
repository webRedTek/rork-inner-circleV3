-- Seed data for the Supabase database
-- Run this in your Supabase SQL editor to populate the database with demo data

-- Insert demo users
-- Note: In a real application, you would use Supabase Auth to create users
-- This is just for demo purposes
INSERT INTO auth.users (id, email, role)
VALUES 
  ('d42c3ebf-7539-49c9-8478-b35b56a9cc5a', 'sarah@example.com', 'authenticated'),
  ('e5f5c5d5-1234-4321-a123-123456789abc', 'michael@example.com', 'authenticated'),
  ('f6f6c6d6-5678-8765-b234-234567890bcd', 'jessica@example.com', 'authenticated'),
  ('g7g7c7d7-9012-2109-c345-345678901cde', 'david@example.com', 'authenticated'),
  ('h8h8c8d8-3456-6543-d456-456789012def', 'emily@example.com', 'authenticated'),
  ('i9i9c9d9-7890-0987-e567-567890123efg', 'alex@example.com', 'authenticated'),
  ('j0j0d0e0-1234-4321-f678-678901234fgh', 'olivia@example.com', 'authenticated'),
  ('k1k1d1e1-5678-8765-g789-789012345ghi', 'james@example.com', 'authenticated'),
  ('l2l2d2e2-9012-2109-h890-890123456hij', 'sophia@example.com', 'authenticated'),
  ('m3m3d3e3-3456-6543-i901-901234567ijk', 'william@example.com', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Insert user profiles
INSERT INTO public.users (
  id, email, name, bio, location, zip_code, business_field, entrepreneur_status, 
  photo_url, membership_tier, business_verified, skills_offered, skills_seeking, 
  industry_focus, business_stage, key_challenge, availability_level, timezone, 
  success_highlight, looking_for
)
VALUES
  (
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'sarah@example.com',
    'Sarah Johnson',
    'Tech entrepreneur with a passion for AI and machine learning. Looking to connect with like-minded founders.',
    'San Francisco, CA',
    '94105',
    'Technology',
    'Founder',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330',
    'premium',
    true,
    ARRAY['AI Development', 'Product Management', 'Fundraising'],
    ARRAY['Marketing', 'Sales'],
    'Artificial Intelligence',
    'Growth',
    'Scaling operations while maintaining product quality',
    ARRAY['Evenings', 'Weekends'],
    'America/Los_Angeles',
    'Raised $2M seed round for my AI startup',
    ARRAY['Investors', 'Technical Co-founder']
  ),
  (
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'michael@example.com',
    'Michael Chen',
    'Serial entrepreneur with 3 successful exits. Currently mentoring early-stage startups in the fintech space.',
    'New York, NY',
    '10012',
    'Finance',
    'Mentor',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d',
    'basic',
    true,
    ARRAY['Financial Modeling', 'Business Strategy', 'Investor Relations'],
    ARRAY['Technical Development', 'UI/UX Design'],
    'Fintech',
    'Established',
    'Finding the right talent for specialized roles',
    ARRAY['Mornings', 'Afternoons'],
    'America/New_York',
    'Built and sold a fintech platform for $50M',
    ARRAY['Mentees', 'Investment Opportunities']
  ),
  (
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'jessica@example.com',
    'Jessica Martinez',
    'E-commerce entrepreneur specializing in sustainable products. Looking to expand into international markets.',
    'Austin, TX',
    '78701',
    'E-commerce',
    'Founder',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80',
    'premium',
    true,
    ARRAY['Supply Chain Management', 'Sustainability', 'E-commerce Operations'],
    ARRAY['International Business', 'Logistics'],
    'Sustainable Retail',
    'Growth',
    'Expanding to European markets while maintaining sustainability standards',
    ARRAY['Flexible'],
    'America/Chicago',
    'Grew revenue by 300% in the past year',
    ARRAY['International Partners', 'Logistics Experts']
  ),
  (
    'g7g7c7d7-9012-2109-c345-345678901cde',
    'david@example.com',
    'David Wilson',
    'Health tech innovator working on wearable devices for chronic disease management.',
    'Boston, MA',
    '02108',
    'Healthcare',
    'Founder',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
    'basic',
    false,
    ARRAY['Medical Device Development', 'Healthcare Regulations', 'Clinical Trials'],
    ARRAY['Manufacturing', 'Hardware Engineering'],
    'Health Technology',
    'Early Stage',
    'Navigating FDA approval process',
    ARRAY['Afternoons', 'Evenings'],
    'America/New_York',
    'Developed a patented technology for glucose monitoring',
    ARRAY['Medical Advisors', 'Hardware Engineers']
  ),
  (
    'h8h8c8d8-3456-6543-d456-456789012def',
    'emily@example.com',
    'Emily Taylor',
    'Marketing expert turned SaaS founder. Building tools to help small businesses compete with larger corporations.',
    'Chicago, IL',
    '60601',
    'Marketing Technology',
    'Founder',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2',
    'premium',
    true,
    ARRAY['Digital Marketing', 'SaaS Development', 'SMB Strategy'],
    ARRAY['Enterprise Sales', 'Customer Success'],
    'Marketing SaaS',
    'Growth',
    'Reducing customer acquisition costs',
    ARRAY['Mornings', 'Weekends'],
    'America/Chicago',
    'Acquired 1,000 paying customers in first year',
    ARRAY['Sales Experts', 'Customer Success Managers']
  ),
  (
    'i9i9c9d9-7890-0987-e567-567890123efg',
    'alex@example.com',
    'Alex Rodriguez',
    'Food tech entrepreneur developing plant-based alternatives to dairy products.',
    'Los Angeles, CA',
    '90001',
    'Food Technology',
    'Founder',
    'https://images.unsplash.com/photo-1552058544-f2b08422138a',
    'basic',
    false,
    ARRAY['Food Science', 'Product Development', 'Sustainability'],
    ARRAY['Manufacturing', 'Distribution'],
    'Alternative Foods',
    'Early Stage',
    'Scaling production while maintaining quality',
    ARRAY['Afternoons', 'Evenings'],
    'America/Los_Angeles',
    'Won "Best New Food Product" at industry expo',
    ARRAY['Food Scientists', 'Manufacturing Partners']
  ),
  (
    'j0j0d0e0-1234-4321-f678-678901234fgh',
    'olivia@example.com',
    'Olivia Brown',
    'EdTech founder creating accessible learning platforms for underserved communities.',
    'Seattle, WA',
    '98101',
    'Education Technology',
    'Founder',
    'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f',
    'premium',
    true,
    ARRAY['Educational Content Development', 'UX Design', 'Non-profit Partnerships'],
    ARRAY['Mobile Development', 'Data Science'],
    'Educational Technology',
    'Growth',
    'Balancing profitability with social impact',
    ARRAY['Flexible'],
    'America/Los_Angeles',
    'Provided free education to 10,000 students in developing countries',
    ARRAY['Education Experts', 'Impact Investors']
  ),
  (
    'k1k1d1e1-5678-8765-g789-789012345ghi',
    'james@example.com',
    'James Thompson',
    'Clean energy entrepreneur developing innovative solar technology.',
    'Denver, CO',
    '80202',
    'Renewable Energy',
    'Founder',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d',
    'basic',
    false,
    ARRAY['Solar Technology', 'Energy Storage', 'Sustainability'],
    ARRAY['Manufacturing', 'Government Relations'],
    'Clean Energy',
    'Early Stage',
    'Securing funding for hardware development',
    ARRAY['Mornings', 'Afternoons'],
    'America/Denver',
    'Developed solar panel with 30% higher efficiency',
    ARRAY['Hardware Engineers', 'Energy Investors']
  ),
  (
    'l2l2d2e2-9012-2109-h890-890123456hij',
    'sophia@example.com',
    'Sophia Garcia',
    'Fintech entrepreneur creating inclusive banking solutions for underbanked populations.',
    'Miami, FL',
    '33101',
    'Financial Technology',
    'Founder',
    'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb',
    'premium',
    true,
    ARRAY['Financial Inclusion', 'Mobile Banking', 'Regulatory Compliance'],
    ARRAY['Data Security', 'UX Design'],
    'Inclusive Banking',
    'Growth',
    'Navigating complex financial regulations across states',
    ARRAY['Evenings', 'Weekends'],
    'America/New_York',
    'Provided banking services to 50,000 previously underbanked individuals',
    ARRAY['Regulatory Experts', 'Financial Inclusion Advocates']
  ),
  (
    'm3m3d3e3-3456-6543-i901-901234567ijk',
    'william@example.com',
    'William Jackson',
    'Blockchain entrepreneur building decentralized solutions for supply chain transparency.',
    'Atlanta, GA',
    '30301',
    'Blockchain',
    'Founder',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e',
    'basic',
    false,
    ARRAY['Blockchain Development', 'Supply Chain', 'Smart Contracts'],
    ARRAY['Enterprise Sales', 'Industry Partnerships'],
    'Supply Chain Technology',
    'Early Stage',
    'Driving enterprise adoption of blockchain solutions',
    ARRAY['Flexible'],
    'America/New_York',
    'Implemented blockchain tracking for major agricultural exporter',
    ARRAY['Enterprise Partners', 'Blockchain Developers']
  )
ON CONFLICT (id) DO NOTHING;

-- Insert some matches
INSERT INTO public.matches (
  id, user_id, matched_user_id, created_at, last_message_at
)
VALUES
  (
    'a1a1a1a1-1111-1111-1111-111111111111',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'b2b2b2b2-2222-2222-2222-222222222222',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  ),
  (
    'c3c3c3c3-3333-3333-3333-333333333333',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'g7g7c7d7-9012-2109-c345-345678901cde',
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
ON CONFLICT (id) DO NOTHING;

-- Insert some messages
INSERT INTO public.messages (
  id, conversation_id, sender_id, receiver_id, content, created_at, read
)
VALUES
  (
    'd4d4d4d4-4444-4444-4444-444444444444',
    'a1a1a1a1-1111-1111-1111-111111111111',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'Hi Michael, I saw your profile and would love to connect about fintech opportunities.',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '2 days') * 1000,
    true
  ),
  (
    'e5e5e5e5-5555-5555-5555-555555555555',
    'a1a1a1a1-1111-1111-1111-111111111111',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'Hello Sarah! Great to connect. I would be happy to discuss fintech opportunities with you. What specific areas are you interested in?',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '1 day') * 1000,
    true
  ),
  (
    'f6f6f6f6-6666-6666-6666-666666666666',
    'a1a1a1a1-1111-1111-1111-111111111111',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'I am particularly interested in AI applications in financial services. My startup is developing an algorithm for risk assessment.',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '12 hours') * 1000,
    false
  ),
  (
    'g7g7g7g7-7777-7777-7777-777777777777',
    'b2b2b2b2-2222-2222-2222-222222222222',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'Hi Jessica, I love what you are doing with sustainable e-commerce. Would you be open to collaboration?',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '3 days') * 1000,
    true
  ),
  (
    'h8h8h8h8-8888-8888-8888-888888888888',
    'b2b2b2b2-2222-2222-2222-222222222222',
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'Hello Sarah! Thank you for reaching out. I would definitely be interested in exploring collaboration opportunities. What did you have in mind?',
    EXTRACT(EPOCH FROM NOW() - INTERVAL '2 days') * 1000,
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Insert some portfolio items
INSERT INTO public.portfolio_items (
  id, user_id, title, description, image_url, link
)
VALUES
  (
    'i9i9i9i9-9999-9999-9999-999999999999',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'AI Risk Assessment Platform',
    'A machine learning platform that analyzes financial data to provide risk assessments for lenders.',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71',
    'https://example.com/ai-platform'
  ),
  (
    'j0j0j0j0-0000-0000-0000-000000000000',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'Smart Investment Advisor',
    'An AI-powered investment advisory tool that provides personalized recommendations based on user goals and risk tolerance.',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f',
    'https://example.com/investment-advisor'
  ),
  (
    'k1k1k1k1-1111-1111-1111-111111111112',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'FinTech Payment Solution',
    'A secure, blockchain-based payment processing system for international transactions.',
    'https://images.unsplash.com/photo-1563986768609-322da13575f3',
    'https://example.com/payment-solution'
  ),
  (
    'l2l2l2l2-2222-2222-2222-222222222223',
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'Sustainable Packaging Initiative',
    'Developed biodegradable packaging solutions that reduced environmental impact by 75%.',
    'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09',
    'https://example.com/sustainable-packaging'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert some groups
INSERT INTO public.groups (
  id, name, description, image_url, member_ids, created_by, category, industry
)
VALUES
  (
    'm3m3m3m3-3333-3333-3333-333333333334',
    'AI Entrepreneurs',
    'A group for founders and professionals working in artificial intelligence and machine learning.',
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e',
    ARRAY['d42c3ebf-7539-49c9-8478-b35b56a9cc5a', 'e5f5c5d5-1234-4321-a123-123456789abc', 'g7g7c7d7-9012-2109-c345-345678901cde'],
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'Technology',
    'Artificial Intelligence'
  ),
  (
    'n4n4n4n4-4444-4444-4444-444444444445',
    'Sustainable Business Network',
    'Connecting entrepreneurs focused on sustainability and environmental impact.',
    'https://images.unsplash.com/photo-1470770841072-f978cf4d019e',
    ARRAY['f6f6c6d6-5678-8765-b234-234567890bcd', 'i9i9c9d9-7890-0987-e567-567890123efg', 'k1k1d1e1-5678-8765-g789-789012345ghi'],
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'Sustainability',
    'Various'
  ),
  (
    'o5o5o5o5-5555-5555-5555-555555555556',
    'Women Founders Alliance',
    'Supporting and connecting women entrepreneurs across all industries.',
    'https://images.unsplash.com/photo-1573164713988-8665fc963095',
    ARRAY['d42c3ebf-7539-49c9-8478-b35b56a9cc5a', 'f6f6c6d6-5678-8765-b234-234567890bcd', 'h8h8c8d8-3456-6543-d456-456789012def', 'j0j0d0e0-1234-4321-f678-678901234fgh', 'l2l2d2e2-9012-2109-h890-890123456hij'],
    'j0j0d0e0-1234-4321-f678-678901234fgh',
    'Networking',
    'Various'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert some likes
INSERT INTO public.likes (
  id, liker_id, liked_id
)
VALUES
  (
    'p6p6p6p6-6666-6666-6666-666666666667',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'e5f5c5d5-1234-4321-a123-123456789abc'
  ),
  (
    'q7q7q7q7-7777-7777-7777-777777777778',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a'
  ),
  (
    'r8r8r8r8-8888-8888-8888-888888888889',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a',
    'f6f6c6d6-5678-8765-b234-234567890bcd'
  ),
  (
    's9s9s9s9-9999-9999-9999-999999999990',
    'f6f6c6d6-5678-8765-b234-234567890bcd',
    'd42c3ebf-7539-49c9-8478-b35b56a9cc5a'
  ),
  (
    't0t0t0t0-0000-0000-0000-000000000001',
    'g7g7c7d7-9012-2109-c345-345678901cde',
    'e5f5c5d5-1234-4321-a123-123456789abc'
  ),
  (
    'u1u1u1u1-1111-1111-1111-111111111112',
    'e5f5c5d5-1234-4321-a123-123456789abc',
    'g7g7c7d7-9012-2109-c345-345678901cde'
  )
ON CONFLICT (id) DO NOTHING;

-- Insert app settings
INSERT INTO public.app_settings (
  id, tier, daily_swipe_limit, daily_match_limit, message_sending_limit, 
  can_see_who_liked_you, can_rewind_last_swipe, boost_duration, boost_frequency,
  profile_visibility_control, priority_listing, premium_filters_access, global_discovery
)
VALUES
  (
    'v2v2v2v2-2222-2222-2222-222222222223',
    'basic',
    20,
    5,
    50,
    false,
    false,
    0,
    0,
    false,
    false,
    false,
    false
  ),
  (
    'w3w3w3w3-3333-3333-3333-333333333334',
    'premium',
    100,
    20,
    unlimited,
    true,
    true,
    30,
    1,
    true,
    true,
    true,
    true
  )
ON CONFLICT (id) DO NOTHING;