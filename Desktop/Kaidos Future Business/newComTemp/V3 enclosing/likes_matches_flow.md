# Likes and Matches System Flow

## Quick Visual Overview

### Complete Flow
```mermaid
graph TD
    subgraph "User Actions"
        A[User Swipes Right] --> B[App Queue]
        A2[User Swipes Left] --> B
    end

    subgraph "App Layer"
        B --> C[Batch Processing]
        C --> D{Check Limits}
        D -->|Within Limits| E[Send to Database]
        D -->|Exceeded| F[Show Limit Notice]
    end

    subgraph "Database Layer"
        E --> G[Record Like]
        G --> H{Check for<br/>Mutual Like}
        H -->|Yes| I[Create Match]
        H -->|No| J[Wait for<br/>Future Like]
        I --> K[Update Usage<br/>for Both Users]
    end

    subgraph "Response Flow"
        K --> L[Return Result]
        L --> M[Update UI]
        M --> N[Show Match<br/>Notification]
    end

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style A2 fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#dfd,stroke:#333,stroke-width:2px
    style E fill:#bbf,stroke:#333,stroke-width:2px
    style F fill:#fdd,stroke:#333,stroke-width:2px
    style G fill:#ffd,stroke:#333,stroke-width:2px
    style H fill:#dfd,stroke:#333,stroke-width:2px
    style I fill:#ffd,stroke:#333,stroke-width:2px
    style J fill:#ffd,stroke:#333,stroke-width:2px
    style K fill:#ffd,stroke:#333,stroke-width:2px
    style L fill:#bbf,stroke:#333,stroke-width:2px
    style M fill:#bbf,stroke:#333,stroke-width:2px
    style N fill:#f9f,stroke:#333,stroke-width:2px
```

### Limits and Tracking System
```mermaid
graph TD
    subgraph "User Tiers & Limits"
        T1["Bronze Tier<br/>• 10 Likes/day<br/>• Limited Matches"]
        T2["Silver Tier<br/>• 50 Likes/day<br/>• More Matches"]
        T3["Gold Tier<br/>• 100 Likes/day<br/>• Unlimited Matches"]
    end

    subgraph "Usage Tracking"
        U1[Daily Reset Counter]
        U2[Track Swipes]
        U3[Track Likes]
        U4[Track Matches]
    end

    subgraph "Match Creation Rules"
        M1{Mutual Like?}
        M2{Within Limits?}
        M3[Create Match]
        M4[Update Both Users]
    end

    T1 & T2 & T3 --> U1
    U1 --> U2 & U3 & U4
    U2 & U3 & U4 --> M1
    M1 -->|Yes| M2
    M2 -->|Yes| M3
    M3 --> M4

    style T1 fill:#ffd,stroke:#333,stroke-width:2px
    style T2 fill:#ffd,stroke:#333,stroke-width:2px
    style T3 fill:#ffd,stroke:#333,stroke-width:2px
    style U1 fill:#dfd,stroke:#333,stroke-width:2px
    style U2 fill:#dfd,stroke:#333,stroke-width:2px
    style U3 fill:#dfd,stroke:#333,stroke-width:2px
    style U4 fill:#dfd,stroke:#333,stroke-width:2px
    style M1 fill:#bbf,stroke:#333,stroke-width:2px
    style M2 fill:#bbf,stroke:#333,stroke-width:2px
    style M3 fill:#f9f,stroke:#333,stroke-width:2px
    style M4 fill:#f9f,stroke:#333,stroke-width:2px
```

## System Overview
The likes and matches system operates through a combination of app-side queueing and database-side processing. This design ensures efficient handling of user interactions while maintaining proper limits and creating matches when appropriate.

## Sequence Flow
```mermaid
sequenceDiagram
    participant User
    participant App
    participant Database
    
    User->>App: Swipes right (like)
    App->>App: Queue swipe
    App->>Database: Process batch swipes
    Database->>Database: Record like
    Database->>Database: Check mutual like
    Database->>Database: Create match if mutual
    Database->>Database: Update usage tracking
    Database-->>App: Return match result
    App->>User: Show match notification
```

## Component Details

### App-side (matches-store.ts)
- Uses batch processing for likes/swipes
- Queues swipes and processes them in batches
- Checks limits before allowing likes/matches
- Tracks pending likes in a Set
- Updates UI state for matches

### Database-side
- Trigger function `create_match_from_mutual_like`:
  - Checks for mutual likes
  - Checks both users' match limits
  - Creates match record
  - Updates usage tracking for both users

### Key Features
1. **Batch Processing**
   - Swipes are queued and processed in batches
   - Reduces database load
   - More efficient than processing each swipe individually

2. **Usage Tracking**
   - Tracks daily limits for:
     - Swipes
     - Likes
     - Matches
   - Different limits based on user tier
   - Updates in real-time

3. **Match Creation**
   - Automatic match creation on mutual likes
   - Respects both users' daily match limits
   - Updates both users' usage tracking
   - Triggers UI notifications

4. **Error Handling**
   - Handles limit exceeded cases
   - Manages network errors
   - Provides user feedback
   - Maintains data consistency

## Database Tables
- `likes`: Records user likes
- `matches`: Stores mutual matches
- `user_daily_usage`: Tracks usage limits

## Related Files
- `matches-store.ts`: App-side state management
- `functions.sql`: Database functions
- `schema.sql`: Table definitions
- `triggers.sql`: Database triggers 