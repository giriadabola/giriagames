(function() { // Self-executing anonymous function for the converter

    // ========================================================================
    // === REPLACED DATA DEFINITIONS (FROM FILE 1) ===
    // ========================================================================

    const categories = [ /* Copied from File 1 */
     // 1. Resultado Final
     "Result", "Match Result", "Match Result (Early Payout)", "Double Chance", "Draw No Bet", "Match Result 1UP", "Team 1 No Bet", "Team 2 No Bet", "1-15 Min. Winner", "1-30 Min. Winner", "1-60 Min. Winner", "1-75 Min. Winner",
     // 2. Golos
     "Both Teams to Score", "Both Teams To Score", "Total Odd/Even", "Total Goals Odd/Even", "1st Goal", "2nd Goal", "3rd Goal", "4th Goal", "5th Goal", "Last Goal", "Goal in Both Halves", "Goals In Both Halves", "Both Halves Over 1.5", "Both Halves Under 1.5", "Both Halves Over 2.5", "Both Halves Under 2.5", "Both Teams to Score in Both Halves", "Total Goals", "Total Goals 0 - 1", "Total Goals 1 - 2", "Total Goals 1 - 3", "Total Goals 2 - 3", "Total Goals 2 - 4", "Total Goals 2 - 5", "Total Goals 2 - 6", "Total Goals 3 - 4", "Total Goals 3 - 5", "Total Goals 4 - 5", "Total Goals 4 - 6", "Total Goals (Bands)", "Total Goals (Exact)", "Total Goals (Extended Bands)", "Total Goals Asian", "Total Goals 3 Way", "Scoring draw", "Only One Team to Score", "Both Teams to Score at Least 1 Half", "Race to 2 Goals", "Race to 3 Goals", "1st Goal to Score", "2nd Goal to Score", "First Team to Score", "Last Team to Score", "First Goal Method", "Exact Number Of Goals", "Exactly 1 Goal in The Match", "Exactly 2 Goal in The Match", "Exactly 3 Goal in The Match", "Exactly 4 Goal in The Match", "Both Teams To Score 2 or More Goals", "Both Teams To Score In Both Halves", "Both Halves More Than 1.5 Goals", "Both Halves Less Than 1.5 Goals", "At Least One Team Will Score Over 1.5 Goals", "At Least One Team Will Score Over 2.5 Goals", "At Least One Team Will Score Over 3.5 Goals", "First 10 Minutes (00:00 – 09:59) Goals", "1st Goal Time (10 min. Interval)", "1st Goal Time (15 min. Interval)", "Halves Total Goals Combination", "Total",
     // 3. Handicap
     "Goals Handicap", "Goals Handicap 3 Way", "Goals Asian Handicap", "1-15 Min. Goals Handicap", "1-30 Min. Goals Handicap", "1-60 Min. Goals Handicap", "1-75 Min. Goals Handicap", "European Handicap (0:1)", "European Handicap (0:2)", "European Handicap (1:0)", "European Handicap (2:0)",
     // 4. Intervalo/Fim do Jogo (HT/FT)
     "Half time/Full time", "Half Time/Full-time", "Half time/Full time - Home/Home", "Half time/Full time - Draw/Home", "Half time/Full time - Draw/Draw", "Half time/Full time - Draw/Away", "Half time/Full time - Away/Away", "Half time/Full time Double Chance", "1st Half Score/Match score", "First Half/Second Half Result", "Half Time/Full-time and Total Goals 1.5", "Half Time/Full-time and Total Goals 2.5", "Half Time/Full-time and Total Goals 3.5", "Half Time/Full-time and Total Goals 4.5", "Half Time/Full-time and Total Goals 5.5",
     // 5. Resultado Exato (Placar)
     "Correct Score", "Score Combinations", "Anytime Correct Score", "Outcome or Correct Score", "Match Score Draw (Except for 0-0)", "Match Score 1:0, 2:0 or 2:1", "Match Score 0:0, 1:0 or 2:0", "Match Score 1:0, 2:0 or 1:1", "Match Score 1:0, 2:0 or 3:0", "Match Score 2:0, 3:0 or 3:1", "Match Score 1:0, 0:0 or 0:1", "Match Score 0:1, 0:2 or 1:2", "Match Score 0:0, 0:1 or 0:2", "Match Score 0:1, 0:2 or 1:1", "Match Score 0:1, 0:2 or 0:3", "Match Score 0:2, 0:3 or 1:3",
     // 6. Específicos por Equipa
     "Team 1 Total Goals", "Team 2 Total Goals", "Team 1 Total Goals (Bands)", "Team 2 Total Goals (Bands)", "Team 1 Total Goals (Exact)", "Team 2 Total Goals (Exact)", "Team 1 Total Goals (Extended Bands)", "Team 2 Total Goals (Extended Bands)", "Team 1 Total Goals Asian", "Team 2 Total Goals Asian", "Team 1 Score in Both Halves", "Team 2 Score in Both Halves", "Team 1 To Score", "Team 2 To Score", "Team 1 Win Both Halves", "Team 2 Win Both Halves", "Team 1 Score in First Half", "Team 1 Score in Second Half", "Team 2 Score in First Half", "Team 2 Score in Second Half", "Team 1 To Win To Nil", "Team 2 To Win To Nil", "Team 1 Win By Two or Three Goals", "Team 2 Win By Two or Three Goals", "Team 1 Win By One Goal or Draw", "Team 2 Win By One Goal or Draw", "Team 1 Will Win at Least in One of The Halves", "Team 2 Will Win at Least in One of The Halves", "Team 1 Will Win 1st Half and Won't Win The Match", "Team 2 Will Win 1st Half and Won't Win The Match", "Team 1 Winning Margin", "Team 2 Winning Margin", "Team 1 To Score First Half/Second Half", "Team 2 To Score First Half/Second Half", "Team 1 Win By Exact 1 Goal", "Team 1 Win By Exact 2 Goal", "Team 2 Win By Exact 1 Goal", "Team 2 Win By Exact 2 Goal", "Team 1 Will Win and Score Exact 1 Goal", "Team 1 Will Win and Score Exact 2 Goal", "Team 1 Will Win and Score Exact 3 Goal", "Team 2 Will Win and Score Exact 1 Goal", "Team 2 Will Win and Score Exact 2 Goal", "Team 2 Will Win and Score Exact 3 Goal", "Team 1 1st Goal Time (10 min. Interval)", "Team 2 1st Goal Time (10 min. Interval)", "Team 1 To Score and Match Result", "Team 2 To Score and Match Result", "Outcome And Team 1 Total Goals 1.5", "Outcome And Team 1 Total Goals 2.5", "Outcome And Team 1 Total Goals 3.5", "Outcome And Team 2 Total Goals 1.5", "Outcome And Team 2 Total Goals 2.5", "Outcome And Team 2 Total Goals 3.5", "Total Team 1", "Total Team 2", "Total Goals Team 1", "Total Goals Team 2", "Team 1 to Score", "Team 2 to Score", "Goal in Both Halves: Team 1", "Goal in Both Halves: Team 2", "Team 1: Total Goals 0 - 1", "Team 1: Total Goals 1 - 2", "Team 1: Total Goals 1 - 3", "Team 1: Total Goals 1 - 4", "Team 1: Total Goals 2 - 3", "Team 1: Total Goals 2 - 4", "Team 1: Total Goals 3 - 4", "Team 1: Total Goals 3 - 6", "Team 2: Total Goals 0 - 1", "Team 2: Total Goals 1 - 2", "Team 2: Total Goals 1 - 3", "Team 2: Total Goals 1 - 4", "Team 2: Total Goals 2 - 3", "Team 2: Total Goals 2 - 4", "Team 2: Total Goals 3 - 4", "Team 2: Total Goals 3 - 6", "Each Team Over 1.5", "Each Team Under 1.5", "Team 1 to Score 2 Goals in a Row", "Team 1 to Score 3 Goals in a Row", "Team 2 to Score 2 Goals in a Row", "Team 2 to Score 3 Goals in a Row", "Win 1 at Least 1 Half", "Win 2 at Least 1 Half", "Win 1 in Both Halves", "Team 1 Highest Scoring Half", "Team 2 Highest Scoring Half", "Team 1 Score Its 1st Goal", "Team 1 Score Its 2nd Goal", "Team 2 to Score Its 1st Goal", "Team 2 to Score Its 2nd Goal",
     // 7. Mercados Combinados
     "Outcome And Total Goals 1.5", "Outcome And Total Goals 2.5", "Outcome And Total Goals 3.5", "Outcome And Total Goals 4.5", "Outcome And Total Goals (Exact)", "Outcome And Total Goals (Extended Bands)", "Outcome And Both To Score", "Double Chance Combo", "Double Chance And Both To Score", "Double Chance and Total Goals (Extended Bands)", "Both Teams To Score And Total Goals 2.5", "Both Teams To Score And Total Goals 3.5", "First Team To Score And Match Result", "Outcome or Total Goals 2.5", "Outcome or Total Goals 3.5", "Outcome or Total Goals 4.5", "Both Teams to Score and Total", "Result and Total", "Double Chance & Total", "Result and Both Teams to Score:", "Double Chance and Both Teams to Score", "Result or Total", "Result or Both Teams To Score:", "Total or Both Teams to Score:", "Team 1 Win 1st Half & Not Win Match", "Team 2 Win 1st Half & Not Win Match", "Team 1 to Score First & Win", "Team 1 to Score First & Not Win", "Team 2 to Score First & Win", "Team 2 to Score First & Not Win", "Team 1 to Win to Nil", "Team 2 to Win to Nil", "1st half Over (0.5) and 2nd half Over (1.5)", "1st half Over (1.5) and 2nd half Over (0.5)", "Total Over (3.5) and 1st half Over (1.5)", "Win1 and 1st half Over (1.5)", "Win2 and 1st half Over (1.5)", "Win1 and 1st half H1 (-1.5)", "Win2 and 1st half H2 (-1.5)", "H1 (-2.5) and 1st half Win1", "H2 (-2.5) and 1st half Win2", "H1 (-1.5) and 1st half Win1", "H2 (-1.5) and 1st half Win2", "Win1 and Team1 Over (1.5)", "Win2 and Team2 Over (1.5)", "Team 1 to Score First and", "Team 2 to Score First and", "Team 1 to Score First and Total", "Team 2 to Score First and Total", "Half time/Full time and Total", "Win1 and Total Goals 2 - 3", "Win2 and Total Goals 2 - 3", "1st Half/2nd Half Both Teams to Score", "1st Half Result or Both Teams To Score:", "2nd Half Result or Both Teams To Score:", "Half time/Full time and Both Teams to Score", "Penalty & Sending Off", "Penalty or Sending Off",
     // 8. Tempo (Timing)
     "Half With Most Goals", "Team 1 Half With Most Goals", "Team 2 Half With Most Goals", "1-15 Min. Total Goals", "1-30 Min. Total Goals", "1-60 Min. Total Goals", "1-75 Min. Total Goals", "1-15 Min. Team 1 Total Goals", "1-15 Min. Team 2 Total Goals", "1-15 Min. Both Teams to Score", "1-30 Min. Team 1 Total Goals", "1-30 Min. Team 2 Total Goals", "1-30 Min. Both Teams to Score", "1-60 Min. Team 1 Total Goals", "1-60 Min. Team 2 Total Goals", "1-60 Min. Both Teams to Score", "1-75 Min. Team 1 Total Goals", "1-75 Min. Team 2 Total Goals", "1-75 Min. Both Teams to Score", "Highest Scoring Half", "1st Goal Minute", "2nd Goal Minute", "Goal from 1 to 10 min.", "Goal from 1 to 15 min.", "Goal from 1 to 20 min.", "Goal from 1 to 25 min.", "Goal from 1 to 30 min.", "Goal from 1 to 35 min.", "Goal from 1 to 40 min.", "Goal from 46 to 60 min.", "Goal from 46 to 65 min.", "Goal from 46 to 70 min.", "Goal from 46 to 75 min.", "Goal from 46 to 80 min.", "Goal from 46 to 85 min.", "Goal from 76 to 90+ min.", "Result from 1 to 10 min.", "Result from 1 to 30 min.", "Result from 1 to 50 min.", "Result from 1 to 60 min.", "Result from 1 to 70 min", "Result from 1 to 75 min", "1-15 min.", "16-30 min.", "31-45+ min.", "46-60 min.", "61-75 min.", "76-90+ min.", "Total Goal Minutes",
     // 9. Por Parte (1ª Parte / 2ª Parte)
     "1st Half Result", "1st Half Double Chance", "1st Half Total Goals", "1st Half Team 1 Total Goals", "1st Half Team 2 Total Goals", "1st Half Goals Handicap", "1st Half Total Goals (Bands)", "1st Half Correct Score", "1st Half Both Teams To Score", "1st Half Goals Handicap 3 Way", "1st Half Total Goals Asian", "1st Half Team 1 Total Goals Asian", "1st Half Team 2 Total Goals Asian", "1st Half Goals Asian Handicap", "1st Half Total Goals (Exact)", "1st Half Team 1 Total Goals (Exact)", "1st Half Team 2 Total Goals (Exact)", "1st Half Team 1 Total Goals (Bands)", "1st Half Team 2 Total Goals (Bands)", "1st Half Team 1 Total Goals (Extended Bands)", "1st Half Team 2 Total Goals (Extended Bands)", "1st Half Total Goals (Extended Bands)", "1st Half Team 1 To Win To Nil", "1st Half Team 2 To Win To Nil", "1st Half First Team to Score", "1st Half Last Team to Score", "1st Half Or Match Result", "1st Half: Outcome And Both Teams To Score", "1 Half Total Goals 3 Way", "2nd Half Result", "2nd Half Double Chance", "2nd Half Total Goals", "2nd Half Team 1 Total Goals", "2nd Half Team 2 Total Goals", "2nd Half Goals Handicap", "2nd Half Correct Score", "2nd Half Both Teams To Score", "2nd Half Goals Handicap 3 Way", "2nd Half Total Goals (Exact)", "2nd Half Team 1 Total Goals (Exact)", "2nd Half Team 2 Total Goals (Exact)", "2nd Half Total Goals (Bands)", "2nd Half Team 1 Total Goals (Bands)", "2nd Half Team 2 Total Goals (Bands)", "2nd Half Total Goals (Extended Bands)", "2nd Half Team 1 Total Goals (Extended Bands)", "2nd Half Team 2 Total Goals (Extended Bands)", "2nd Half Team 1 To Win To Nil", "2nd Half Team 2 To Win To Nil", "2nd Half First Team to Score", "2nd Half Last Team to Score", "2nd Half: Outcome And Both Teams To Score", "1st Half/2nd Half Both To Score", "First Half Total Goals Vs Second Half Total Goals Handicap", "Goal in First Half", "Goal in Second Half", "Each Half Will Be Won By A Different Team", "Draw at Least in One of The Halves", "1st Half: Goal", "2nd Half: Goal", "1st Half: Sending Off", "2nd Half: Sending Off", "1st Half: Penalty", "2nd Half: Penalty", "1st half: Both Teams to Score", "2nd half: Both Teams to Score", "1st half: Total Team 1", "1st half: Total Team 2", "1st half: Total Even/Odd", "2nd half: Total Team 1", "2nd half: Total Team 2", "2nd half: Total Even/Odd", "1st half: Correct Score", "2nd half: Correct Score", "1st half: Result", "1st half: Double Chance", "1st half: Team 1 to Score", "1st half: Team 2 to Score", "1st half: Result and Total", "1st half: Result and Both Teams to Score:", "1st half: 1st Goal", "1st half: 2nd Goal", "1st half: 3rd Goal", "1st half: European Handicap (0:1)", "1st half: European Handicap (1:0)", "1st half: Total Goals 0 - 1", "1st half: Total Goals 1 - 2", "1st half: Total Goals 1 - 3", "1st half: Total Goals 2 - 3", "1st half: Total Goals 2 - 4", "1st half: Total Goals 2 - 5", "1st half: Total Goals 2 - 6", "1st half: Total Goals 3 - 4", "1st half: Total Goals 3 - 5", "1st half: Team 1: Total Goals 0 - 1", "1st half: Team 1: Total Goals 1 - 2", "1st half: Team 1: Total Goals 1 - 3", "1st half: Team 1: Total Goals 1 - 4", "1st half: Team 1: Total Goals 2 - 3", "1st half: Team 1: Total Goals 2 - 4", "1st half: Team 2: Total Goals 0 - 1", "1st half: Team 2: Total Goals 1 - 2", "1st half: Team 2: Total Goals 1 - 3", "1st half: Team 2: Total Goals 1 - 4", "1st half: Team 2: Total Goals 2 - 3", "1st half: Team 2: Total Goals 2 - 4", "1st half: Total Goals Team 1", "1st half: Total Goals Team 2", "1st half: Total Goals", "1st half: Team 1 to Win to Nil", "1st half: Team 2 to Win to Nil", "1st half: Last Goal", "2nd half: Result", "2nd half: Double Chance", "2nd half: Team 1 to Score", "2nd half: Team 2 to Score", "2nd half: 1st Goal", "2nd half: 2nd Goal", "2nd half: 3rd Goal", "2nd half: European Handicap (0:1)", "2nd half: European Handicap (1:0)", "2nd half: Total Goals 0 - 1", "2nd half: Total Goals 1 - 2", "2nd half: Total Goals 1 - 3", "2nd half: Total Goals 2 - 3", "2nd half: Total Goals 2 - 4", "2nd half: Total Goals 2 - 5", "2nd half: Total Goals 2 - 6", "2nd half: Total Goals 3 - 4", "2nd half: Total Goals 3 - 5", "2nd half: Team 1: Total Goals 0 - 1", "2nd half: Team 1: Total Goals 1 - 2", "2nd half: Team 1: Total Goals 1 - 3", "2nd half: Team 1: Total Goals 1 - 4", "2nd half: Team 1: Total Goals 2 - 3", "2nd half: Team 1: Total Goals 2 - 4", "2nd half: Team 2: Total Goals 0 - 1", "2nd half: Team 2: Total Goals 1 - 2", "2nd half: Team 2: Total Goals 1 - 3", "2nd half: Team 2: Total Goals 1 - 4", "2nd half: Team 2: Total Goals 2 - 3", "2nd half: Team 2: Total Goals 2 - 4", "2nd half: Total Goals Team 1", "2nd half: Total Goals Team 2", "2nd half: Total Goals", "2nd half: Team 1 to Win to Nil", "2nd half: Team 2 to Win to Nil", "2nd half: Last Goal", "1st half or match",
     // 10. Mercados Especiais / Eventos
     "Tie Breaker", "Penalty", "Sending Off", "Sending Off Team 1", "Sending Off Team 2", "1st to Happen:", "How is Scored 1st Goal", "Team 1 Winning Margin 1 Goal", "Team 1 Winning Margin 2 Goals", "Team 1 Winning Margin 1 or 2 Goals", "Team 1 Winning Margin 2 or 3 Goals", "Team 1 Winning Margin 2 or more Goals", "Team 1 Winning Margin 1 Goal or Draw", "Team 1 Winning Margin 2 Goals or Draw", "Team 2 Winning Margin 1 Goal", "Team 2 Winning Margin 2 Goals", "Team 2 Winning Margin 1 or 2 Goals", "Team 2 Winning Margin 2 or 3 Goals", "Team 2 Winning Margin 2 or more Goals", "Team 2 Winning Margin 1 Goal or Draw", "Team 2 Winning Margin 2 Goals or Draw", "Draw in at least one of the Halves", "Any Team Winning Margin 1", "Any Team Winning Margin 2", "Any Team Winning Margin 3", "Any Team Winning Margin 2 & more", "Any Team Winning Margin 3 & more", "Team 1 win from Behind", "Team 2 Win from Behind", "Own Goal", "Double", "1:1 During The Match", "2:0 or 0:2 During The Match", "2:0 During The Match", "0:2 During The Match", "To Miss A Penalty", "To Score A Penalty", "Red card in both teams",
     // 11. Cantos
     "Corners: Total Team 1", "Corners: Total Team 2", "Corners: Total Even/Odd", "Corners: 1st Half: Total:", "Corners: 1st Half: Total Team 1", "Corners: 1st Half: Total Team 2", "Corners: 2nd Half: Total", "Corners: 2nd Half: Total Team 1", "Corners: 2nd Half: Total Team 2", "Corners: Total (3 way)", "Corners: 1st Half: Handicap", "Corners: 2nd Half: Handicap", "Corners: Result", "Corners: 1st Half: Result", "Corners: 2nd Half: Result", "Corners: Highest Scoring Half", "Corners: 1st Corner", "Corners: Last Corner:", "Corners: 10 Minutes Corners (00:00-9:59)", "Corners: Race to Corners",
     // 12. Cartões Amarelos
     "Yellow Cards: Total Team 1", "Yellow Cards: Total Team 2", "Yellow Cards: Total Odd/Even", "Yellow Cards: 1st Half: Total:", "Yellow Cards: 1st Half: Total Team 1", "Yellow Cards: 1st Half: Total Team 2", "Yellow Cards: 2nd Half: Total", "Yellow Cards: 1st Half: Handicap", "Yellow Cards: 2nd Half: Handicap", "Yellow Cards: Result", "Yellow Cards: Double Chance", "Yellow Cards: 1st Half: Result", "Yellow Cards: 1st Half: Double Chance", "Yellow Cards: 2nd Half: Result", "Yellow Cards: 2nd Half: Double Chance", "Yellow Cards: Highest Scoring Half", "Yellow Cards: 1st Yellow Card Minute", "Yellow Cards: Both Teams to Receive Cards", "Yellow Cards: Both Teams to Receive 2 or More Cards",
     // 13. Remates à Baliza
     "Shots on target: Total", "Shots on target: Total Team 1", "Shots on target: Total Team 2", "Shots on target: Total Even/Odd", "Shots on target: 1st Half: Total:", "Shots on target: 1st Half: Total Team 1", "Shots on target: 1st Half: Total Team 2", "Shots on target: Handicap", "Shots on target: 1st Half: Handicap", "Shots on target: Result", "Shots on target: Double Chance", "Shots on target: 1st Half: Result", "Shots on target: 1st Half: Double Chance", "Shots on target: Highest Scoring Half",
     // 14. Faltas
     "Fouls: Total", "Fouls: Total Team 1", "Fouls: Total Team 2", "Fouls: Total Even/Odd", "Fouls: Handicap", "Fouls: Result", "Fouls: Double Chance", "Fouls: Highest Scoring Half", "Offsides: Total", "Offsides: Total Team 1", "Offsides: Total Team 2", "Offsides: Total Even/Odd", "Offsides: Handicap", "Offsides: Result", "Offsides: Double Chance",
     // 15. Remates Totais
     "Shots: Total", "Shots: Total Team 1", "Shots: Total Team 2", "Shots: Total Even/Odd", "Shots: 1st Half: Total Team 1", "Shots: 1st Half: Total Team 2", "Shots: Handicap", "Shots: 1st Half: Handicap", "Shots: Result", "Shots: Double Chance", "Shots: 1st Half: Result", "Shots: 1st Half: Double Chance", "Shots: Highest Scoring Half",
     // 16. Jogadores
     "Players:" // Base for player markets
    ];

    const specialCategories = new Set([
        "Total",
        "Asian Total",
        "Handicap",
        "Asian Handicap",
        "1st half: Total",
        "1st half: Asian Total",
        "1st half: Handicap",
        "1st half: Asian Handicap",
        "2nd half: Total",
        "2nd half: Asian Total",
        "2nd half: Handicap",
        "2nd half: Asian Handicap",
        "Corners: Total",
        "Corners: Handicap",
        "Yellow Cards: Total",
        "Yellow Cards: Handicap"
    ]);

    const categoryMap = {
         // 1. Resultado Final
         "Result": "Resultado Final", "Match Result": "Resultado Final", "Match Result (Early Payout)": "Resultado Final", "Double Chance": "Resultado Final", "Draw No Bet": "Resultado Final", "Match Result 1UP": "Resultado Final", "Team 1 No Bet": "Resultado Final", "Team 2 No Bet": "Resultado Final", "1-15 Min. Winner": "Resultado Final", "1-30 Min. Winner": "Resultado Final", "1-60 Min. Winner": "Resultado Final", "1-75 Min. Winner": "Resultado Final",
         // 2. Golos
         "Total": "Golos", "Both Teams to Score": "Golos", "Both Teams To Score": "Golos", "Asian Total": "Golos", "Total Odd/Even": "Golos", "Total Goals Odd/Even": "Golos", "1st Goal": "Golos", "2nd Goal": "Golos", "3rd Goal": "Golos", "4th Goal": "Golos", "5th Goal": "Golos", "Last Goal": "Golos", "Goal in Both Halves": "Golos", "Goals In Both Halves": "Golos", "Both Halves Over 1.5": "Golos", "Both Halves Under 1.5": "Golos", "Both Halves Over 2.5": "Golos", "Both Halves Under 2.5": "Golos", "Both Teams to Score in Both Halves": "Golos", "Total Goals": "Golos", "Total Goals 0 - 1": "Golos", "Total Goals 1 - 2": "Golos", "Total Goals 1 - 3": "Golos", "Total Goals 2 - 3": "Golos", "Total Goals 2 - 4": "Golos", "Total Goals 2 - 5": "Golos", "Total Goals 2 - 6": "Golos", "Total Goals 3 - 4": "Golos", "Total Goals 3 - 5": "Golos", "Total Goals 4 - 5": "Golos", "Total Goals 4 - 6": "Golos", "Total Goals (Bands)": "Golos", "Total Goals (Exact)": "Golos", "Total Goals (Extended Bands)": "Golos", "Total Goals Asian": "Golos", "Total Goals 3 Way": "Golos", "Scoring draw": "Golos", "Only One Team to Score": "Golos", "Both Teams to Score at Least 1 Half": "Golos", "Race to 2 Goals": "Golos", "Race to 3 Goals": "Golos", "1st Goal to Score": "Golos", "2nd Goal to Score": "Golos", "First Team to Score": "Golos", "Last Team to Score": "Golos", "First Goal Method": "Golos", "Exact Number Of Goals": "Golos", "Exactly 1 Goal in The Match": "Golos", "Exactly 2 Goal in The Match": "Golos", "Exactly 3 Goal in The Match": "Golos", "Exactly 4 Goal in The Match": "Golos", "Both Teams To Score 2 or More Goals": "Golos", "Both Teams To Score In Both Halves": "Golos", "Both Halves More Than 1.5 Goals": "Golos", "Both Halves Less Than 1.5 Goals": "Golos", "At Least One Team Will Score Over 1.5 Goals": "Golos", "At Least One Team Will Score Over 2.5 Goals": "Golos", "At Least One Team Will Score Over 3.5 Goals": "Golos", "First 10 Minutes (00:00 – 09:59) Goals": "Golos", "1st Goal Time (10 min. Interval)": "Golos", "1st Goal Time (15 min. Interval)": "Golos", "Halves Total Goals Combination": "Golos",
         // 3. Handicap
         "Handicap": "Handicap", "Asian Handicap": "Handicap", "European Handicap (0:1)": "Handicap", "European Handicap (0:2)": "Handicap", "European Handicap (1:0)": "Handicap", "European Handicap (2:0)": "Handicap", "Goals Handicap": "Handicap", "Goals Handicap 3 Way": "Handicap", "Goals Asian Handicap": "Handicap", "1-15 Min. Goals Handicap": "Handicap", "1-30 Min. Goals Handicap": "Handicap", "1-60 Min. Goals Handicap": "Handicap", "1-75 Min. Goals Handicap": "Handicap",
         // 4. Intervalo/Fim do Jogo (HT/FT)
         "Half time/Full time": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time - Home/Home": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time - Draw/Home": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time - Draw/Draw": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time - Draw/Away": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time - Away/Away": "Intervalo/Fim do Jogo (HT/FT)", "Half time/Full time Double Chance": "Intervalo/Fim do Jogo (HT/FT)", "1st Half Score/Match score": "Intervalo/Fim do Jogo (HT/FT)", "First Half/Second Half Result": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time and Total Goals 1.5": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time and Total Goals 2.5": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time and Total Goals 3.5": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time and Total Goals 4.5": "Intervalo/Fim do Jogo (HT/FT)", "Half Time/Full-time and Total Goals 5.5": "Intervalo/Fim do Jogo (HT/FT)",
         // 5. Resultado Exato (Placar)
         "Correct Score": "Resultado Exato (Placar)", "Score Combinations": "Resultado Exato (Placar)", "Anytime Correct Score": "Resultado Exato (Placar)", "Outcome or Correct Score": "Resultado Exato (Placar)", "Match Score Draw (Except for 0-0)": "Resultado Exato (Placar)", "Match Score 1:0, 2:0 or 2:1": "Resultado Exato (Placar)", "Match Score 0:0, 1:0 or 2:0": "Resultado Exato (Placar)", "Match Score 1:0, 2:0 or 1:1": "Resultado Exato (Placar)", "Match Score 1:0, 2:0 or 3:0": "Resultado Exato (Placar)", "Match Score 2:0, 3:0 or 3:1": "Resultado Exato (Placar)", "Match Score 1:0, 0:0 or 0:1": "Resultado Exato (Placar)", "Match Score 0:1, 0:2 or 1:2": "Resultado Exato (Placar)", "Match Score 0:0, 0:1 or 0:2": "Resultado Exato (Placar)", "Match Score 0:1, 0:2 or 1:1": "Resultado Exato (Placar)", "Match Score 0:1, 0:2 or 0:3": "Resultado Exato (Placar)", "Match Score 0:2, 0:3 or 1:3": "Resultado Exato (Placar)",
         // 6. Específicos por Equipa
         "Total Team 1": "Específicos por Equipa", "Total Team 2": "Específicos por Equipa", "Total Goals Team 1": "Específicos por Equipa", "Total Goals Team 2": "Específicos por Equipa", "Team 1 to Score": "Específicos por Equipa", "Team 2 to Score": "Específicos por Equipa", "Team 1 To Score": "Específicos por Equipa", "Team 2 To Score": "Específicos por Equipa", "Team 1 Total Goals": "Específicos por Equipa", "Team 2 Total Goals": "Específicos por Equipa", "Team 1 Total Goals (Bands)": "Específicos por Equipa", "Team 2 Total Goals (Bands)": "Específicos por Equipa", "Team 1 Total Goals (Exact)": "Específicos por Equipa", "Team 2 Total Goals (Exact)": "Específicos por Equipa", "Team 1 Total Goals (Extended Bands)": "Específicos por Equipa", "Team 2 Total Goals (Extended Bands)": "Específicos por Equipa", "Team 1 Total Goals Asian": "Específicos por Equipa", "Team 2 Total Goals Asian": "Específicos por Equipa", "Team 1 Score in Both Halves": "Específicos por Equipa", "Team 2 Score in Both Halves": "Específicos por Equipa", "Team 1 Win Both Halves": "Específicos por Equipa", "Team 2 Win Both Halves": "Específicos por Equipa", "Team 1 Score in First Half": "Específicos por Equipa", "Team 1 Score in Second Half": "Específicos por Equipa", "Team 2 Score in First Half": "Específicos por Equipa", "Team 2 Score in Second Half": "Específicos por Equipa", "Team 1 To Win To Nil": "Específicos por Equipa", "Team 2 To Win To Nil": "Específicos por Equipa", "Team 1 Win By Two or Three Goals": "Específicos por Equipa", "Team 2 Win By Two or Three Goals": "Específicos por Equipa", "Team 1 Win By One Goal or Draw": "Específicos por Equipa", "Team 2 Win By One Goal or Draw": "Específicos por Equipa", "Team 1 Will Win at Least in One of The Halves": "Específicos por Equipa", "Team 2 Will Win at Least in One of The Halves": "Específicos por Equipa", "Team 1 Will Win 1st Half and Won't Win The Match": "Específicos por Equipa", "Team 2 Will Win 1st Half and Won't Win The Match": "Específicos por Equipa", "Team 1 Winning Margin": "Específicos por Equipa", "Team 2 Winning Margin": "Específicos por Equipa", "Team 1 To Score First Half/Second Half": "Específicos por Equipa", "Team 2 To Score First Half/Second Half": "Específicos por Equipa", "Team 1 Win By Exact 1 Goal": "Específicos por Equipa", "Team 1 Win By Exact 2 Goal": "Específicos por Equipa", "Team 2 Win By Exact 1 Goal": "Específicos por Equipa", "Team 2 Win By Exact 2 Goal": "Específicos por Equipa", "Team 1 Will Win and Score Exact 1 Goal": "Específicos por Equipa", "Team 1 Will Win and Score Exact 2 Goal": "Específicos por Equipa", "Team 1 Will Win and Score Exact 3 Goal": "Específicos por Equipa", "Team 2 Will Win and Score Exact 1 Goal": "Específicos por Equipa", "Team 2 Will Win and Score Exact 2 Goal": "Específicos por Equipa", "Team 2 Will Win and Score Exact 3 Goal": "Específicos por Equipa", "Team 1 1st Goal Time (10 min. Interval)": "Específicos por Equipa", "Team 2 1st Goal Time (10 min. Interval)": "Específicos por Equipa", "Team 1 To Score and Match Result": "Específicos por Equipa", "Team 2 To Score and Match Result": "Específicos por Equipa", "Outcome And Team 1 Total Goals 1.5": "Específicos por Equipa", "Outcome And Team 1 Total Goals 2.5": "Específicos por Equipa", "Outcome And Team 1 Total Goals 3.5": "Específicos por Equipa", "Outcome And Team 2 Total Goals 1.5": "Específicos por Equipa", "Outcome And Team 2 Total Goals 2.5": "Específicos por Equipa", "Outcome And Team 2 Total Goals 3.5": "Específicos por Equipa", "Goal in Both Halves: Team 1": "Específicos por Equipa", "Goal in Both Halves: Team 2": "Específicos por Equipa", "Each Team Over 1.5": "Específicos por Equipa", "Each Team Under 1.5": "Específicos por Equipa", "Win 1 at Least 1 Half": "Específicos por Equipa", "Win 2 at Least 1 Half": "Específicos por Equipa", "Win 1 in Both Halves": "Específicos por Equipa", "Team 1 Highest Scoring Half": "Específicos por Equipa", "Team 2 Highest Scoring Half": "Específicos por Equipa", "Team 1 Score Its 1st Goal": "Específicos por Equipa", "Team 1 Score Its 2nd Goal": "Específicos por Equipa", "Team 2 to Score Its 1st Goal": "Específicos por Equipa", "Team 2 to Score Its 2nd Goal": "Específicos por Equipa",
         // 7. Mercados Combinados
         "Outcome And Total Goals 1.5": "Mercados Combinados", "Outcome And Total Goals 2.5": "Mercados Combinados", "Outcome And Total Goals 3.5": "Mercados Combinados", "Outcome And Total Goals 4.5": "Mercados Combinados", "Outcome And Total Goals (Exact)": "Mercados Combinados", "Outcome And Total Goals (Extended Bands)": "Mercados Combinados", "Outcome And Both To Score": "Mercados Combinados", "Double Chance Combo": "Mercados Combinados", "Double Chance And Both To Score": "Mercados Combinados", "Double Chance and Total Goals (Extended Bands)": "Mercados Combinados", "Both Teams To Score And Total Goals 2.5": "Mercados Combinados", "Both Teams To Score And Total Goals 3.5": "Mercados Combinados", "First Team To Score And Match Result": "Mercados Combinados", "Outcome or Total Goals 2.5": "Mercados Combinados", "Outcome or Total Goals 3.5": "Mercados Combinados", "Outcome or Total Goals 4.5": "Mercados Combinados", "Both Teams to Score and Total": "Mercados Combinados", "Result and Total": "Mercados Combinados", "Double Chance & Total": "Mercados Combinados", "Result and Both Teams to Score:": "Mercados Combinados", "Double Chance and Both Teams to Score": "Mercados Combinados", "Result or Total": "Mercados Combinados", "Result or Both Teams To Score:": "Mercados Combinados", "Total or Both Teams to Score:": "Mercados Combinados", "Team 1 Win 1st Half & Not Win Match": "Mercados Combinados", "Team 2 Win 1st Half & Not Win Match": "Mercados Combinados", "Team 1 to Score First & Win": "Mercados Combinados", "Team 1 to Score First & Not Win": "Mercados Combinados", "Team 2 to Score First & Win": "Mercados Combinados", "Team 2 to Score First & Not Win": "Mercados Combinados", "Team 1 to Win to Nil": "Mercados Combinados", "Team 2 to Win to Nil": "Mercados Combinados", "1st half Over (0.5) and 2nd half Over (1.5)": "Mercados Combinados", "1st half Over (1.5) and 2nd half Over (0.5)": "Mercados Combinados", "Total Over (3.5) and 1st half Over (1.5)": "Mercados Combinados", "Win1 and 1st half Over (1.5)": "Mercados Combinados", "Win2 and 1st half Over (1.5)": "Mercados Combinados", "Win1 and 1st half H1 (-1.5)": "Mercados Combinados", "Win2 and 1st half H2 (-1.5)": "Mercados Combinados", "H1 (-2.5) and 1st half Win1": "Mercados Combinados", "H2 (-2.5) and 1st half Win2": "Mercados Combinados", "H1 (-1.5) and 1st half Win1": "Mercados Combinados", "H2 (-1.5) and 1st half Win2": "Mercados Combinados", "Win1 and Team1 Over (1.5)": "Mercados Combinados", "Win2 and Team2 Over (1.5)": "Mercados Combinados", "Team 1 to Score First and": "Mercados Combinados", "Team 2 to Score First and": "Mercados Combinados", "Team 1 to Score First and Total": "Mercados Combinados", "Team 2 to Score First and Total": "Mercados Combinados", "Half time/Full time and Total": "Mercados Combinados", "Win1 and Total Goals 2 - 3": "Mercados Combinados", "Win2 and Total Goals 2 - 3": "Mercados Combinados", "1st Half/2nd Half Both Teams to Score": "Mercados Combinados", "1st Half Result or Both Teams To Score:": "Mercados Combinados", "2nd Half Result or Both Teams To Score:": "Mercados Combinados", "Half time/Full time and Both Teams to Score": "Mercados Combinados", "Penalty & Sending Off": "Mercados Combinados", "Penalty or Sending Off": "Mercados Combinados",
         // 8. Tempo (Timing)
         "Half With Most Goals": "Tempo (Timing)", "Team 1 Half With Most Goals": "Tempo (Timing)", "Team 2 Half With Most Goals": "Tempo (Timing)", "1-15 Min. Total Goals": "Tempo (Timing)", "1-30 Min. Total Goals": "Tempo (Timing)", "1-60 Min. Total Goals": "Tempo (Timing)", "1-75 Min. Total Goals": "Tempo (Timing)", "1-15 Min. Team 1 Total Goals": "Tempo (Timing)", "1-15 Min. Team 2 Total Goals": "Tempo (Timing)", "1-15 Min. Both Teams to Score": "Tempo (Timing)", "1-30 Min. Team 1 Total Goals": "Tempo (Timing)", "1-30 Min. Team 2 Total Goals": "Tempo (Timing)", "1-30 Min. Both Teams to Score": "Tempo (Timing)", "1-60 Min. Team 1 Total Goals": "Tempo (Timing)", "1-60 Min. Team 2 Total Goals": "Tempo (Timing)", "1-60 Min. Both Teams to Score": "Tempo (Timing)", "1-75 Min. Team 1 Total Goals": "Tempo (Timing)", "1-75 Min. Team 2 Total Goals": "Tempo (Timing)", "1-75 Min. Both Teams to Score": "Tempo (Timing)", "Highest Scoring Half": "Tempo (Timing)", "1st Goal Minute": "Tempo (Timing)", "2nd Goal Minute": "Tempo (Timing)", "Goal from 1 to 10 min.": "Tempo (Timing)", "Goal from 1 to 15 min.": "Tempo (Timing)", "Goal from 1 to 20 min.": "Tempo (Timing)", "Goal from 1 to 25 min.": "Tempo (Timing)", "Goal from 1 to 30 min.": "Tempo (Timing)", "Goal from 1 to 35 min.": "Tempo (Timing)", "Goal from 1 to 40 min.": "Tempo (Timing)", "Goal from 46 to 60 min.": "Tempo (Timing)", "Goal from 46 to 65 min.": "Tempo (Timing)", "Goal from 46 to 70 min.": "Tempo (Timing)", "Goal from 46 to 75 min.": "Tempo (Timing)", "Goal from 46 to 80 min.": "Tempo (Timing)", "Goal from 46 to 85 min.": "Tempo (Timing)", "Goal from 76 to 90+ min.": "Tempo (Timing)", "Result from 1 to 10 min.": "Tempo (Timing)", "Result from 1 to 30 min.": "Tempo (Timing)", "Result from 1 to 50 min.": "Tempo (Timing)", "Result from 1 to 60 min.": "Tempo (Timing)", "Result from 1 to 70 min": "Tempo (Timing)", "Result from 1 to 75 min": "Tempo (Timing)", "1-15 min.": "Tempo (Timing)", "16-30 min.": "Tempo (Timing)", "31-45+ min.": "Tempo (Timing)", "46-60 min.": "Tempo (Timing)", "61-75 min.": "Tempo (Timing)", "76-90+ min.": "Tempo (Timing)", "Total Goal Minutes": "Tempo (Timing)",
         // 9. Por Parte (1ª Parte / 2ª Parte)
         "1st Half Result": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Double Chance": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Goals Handicap": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Correct Score": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Both Teams To Score": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Goals Handicap 3 Way": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Total Goals Asian": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 Total Goals Asian": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 Total Goals Asian": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Goals Asian Handicap": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 1 To Win To Nil": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Team 2 To Win To Nil": "Por Parte (1ª Parte / 2ª Parte)", "1st Half First Team to Score": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Last Team to Score": "Por Parte (1ª Parte / 2ª Parte)", "1st Half Or Match Result": "Por Parte (1ª Parte / 2ª Parte)", "1st Half: Outcome And Both Teams To Score": "Por Parte (1ª Parte / 2ª Parte)", "1 Half Total Goals 3 Way": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Result": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Double Chance": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 1 Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 2 Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Goals Handicap": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Correct Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Both Teams To Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Goals Handicap 3 Way": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 1 Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 2 Total Goals (Exact)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 1 Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 2 Total Goals (Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 1 Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 2 Total Goals (Extended Bands)": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 1 To Win To Nil": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Team 2 To Win To Nil": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half First Team to Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half Last Team to Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half: Outcome And Both Teams To Score": "Por Parte (1ª Parte / 2ª Parte)", "1st Half/2nd Half Both To Score": "Por Parte (1ª Parte / 2ª Parte)", "First Half Total Goals Vs Second Half Total Goals Handicap": "Por Parte (1ª Parte / 2ª Parte)", "Goal in First Half": "Por Parte (1ª Parte / 2ª Parte)", "Goal in Second Half": "Por Parte (1ª Parte / 2ª Parte)", "Each Half Will Be Won By A Different Team": "Por Parte (1ª Parte / 2ª Parte)", "Draw at Least in One of The Halves": "Por Parte (1ª Parte / 2ª Parte)", "1st Half: Goal": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half: Goal": "Por Parte (1ª Parte / 2ª Parte)", "1st Half: Sending Off": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half: Sending Off": "Por Parte (1ª Parte / 2ª Parte)", "1st Half: Penalty": "Por Parte (1ª Parte / 2ª Parte)", "2nd Half: Penalty": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Both Teams to Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Both Teams to Score": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Team 1": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Team 2": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Even/Odd": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Team 1": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Team 2": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Even/Odd": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Correct Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Correct Score": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Result": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Double Chance": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1 to Score": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2 to Score": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Result and Total": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Result and Both Teams to Score:": "Por Parte (1ª Parte / 2ª Parte)", "1st half: 1st Goal": "Por Parte (1ª Parte / 2ª Parte)", "1st half: 2nd Goal": "Por Parte (1ª Parte / 2ª Parte)", "1st half: 3rd Goal": "Por Parte (1ª Parte / 2ª Parte)", "1st half: European Handicap (0:1)": "Por Parte (1ª Parte / 2ª Parte)", "1st half: European Handicap (1:0)": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 2 - 5": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 2 - 6": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 3 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals 3 - 5": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 1 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 1 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals Team 1": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals Team 2": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 1 to Win to Nil": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Team 2 to Win to Nil": "Por Parte (1ª Parte / 2ª Parte)", "1st half: Last Goal": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Result": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Double Chance": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1 to Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2 to Score": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: 1st Goal": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: 2nd Goal": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: 3rd Goal": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: European Handicap (0:1)": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: European Handicap (1:0)": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 2 - 5": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 2 - 6": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 3 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals 3 - 5": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 1 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 0 - 1": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 1 - 2": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 1 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 1 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 2 - 3": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2: Total Goals 2 - 4": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals Team 1": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals Team 2": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Total Goals": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 1 to Win to Nil": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Team 2 to Win to Nil": "Por Parte (1ª Parte / 2ª Parte)", "2nd half: Last Goal": "Por Parte (1ª Parte / 2ª Parte)", "1st half or match": "Por Parte (1ª Parte / 2ª Parte)",
         // 10. Mercados Especiais / Eventos
         "Tie Breaker": "Mercados Especiais / Eventos", "Penalty": "Mercados Especiais / Eventos", "Sending Off": "Mercados Especiais / Eventos", "Sending Off Team 1": "Mercados Especiais / Eventos", "Sending Off Team 2": "Mercados Especiais / Eventos", "1st to Happen:": "Mercados Especiais / Eventos", "How is Scored 1st Goal": "Mercados Especiais / Eventos", "Team 1 Winning Margin 1 Goal": "Mercados Especiais / Eventos", "Team 1 Winning Margin 2 Goals": "Mercados Especiais / Eventos", "Team 1 Winning Margin 1 or 2 Goals": "Mercados Especiais / Eventos", "Team 1 Winning Margin 2 or 3 Goals": "Mercados Especiais / Eventos", "Team 1 Winning Margin 2 or more Goals": "Mercados Especiais / Eventos", "Team 1 Winning Margin 1 Goal or Draw": "Mercados Especiais / Eventos", "Team 1 Winning Margin 2 Goals or Draw": "Mercados Especiais / Eventos", "Team 2 Winning Margin 1 Goal": "Mercados Especiais / Eventos", "Team 2 Winning Margin 2 Goals": "Mercados Especiais / Eventos", "Team 2 Winning Margin 1 or 2 Goals": "Mercados Especiais / Eventos", "Team 2 Winning Margin 2 or 3 Goals": "Mercados Especiais / Eventos", "Team 2 Winning Margin 2 or more Goals": "Mercados Especiais / Eventos", "Team 2 Winning Margin 1 Goal or Draw": "Mercados Especiais / Eventos", "Team 2 Winning Margin 2 Goals or Draw": "Mercados Especiais / Eventos", "Draw in at least one of the Halves": "Mercados Especiais / Eventos", "Any Team Winning Margin 1": "Mercados Especiais / Eventos", "Any Team Winning Margin 2": "Mercados Especiais / Eventos", "Any Team Winning Margin 3": "Mercados Especiais / Eventos", "Any Team Winning Margin 2 & more": "Mercados Especiais / Eventos", "Any Team Winning Margin 3 & more": "Mercados Especiais / Eventos", "Team 1 win from Behind": "Mercados Especiais / Eventos", "Team 2 Win from Behind": "Mercados Especiais / Eventos", "Own Goal": "Mercados Especiais / Eventos", "Double": "Mercados Especiais / Eventos", "1:1 During The Match": "Mercados Especiais / Eventos", "2:0 or 0:2 During The Match": "Mercados Especiais / Eventos", "2:0 During The Match": "Mercados Especiais / Eventos", "0:2 During The Match": "Mercados Especiais / Eventos", "To Miss A Penalty": "Mercados Especiais / Eventos", "To Score A Penalty": "Mercados Especiais / Eventos", "Red card in both teams": "Mercados Especiais / Eventos",
         // 11. Cantos
         "Corners: Total Team 1": "Cantos", "Corners: Total Team 2": "Cantos", "Corners: Total Even/Odd": "Cantos", "Corners: 1st Half: Total:": "Cantos", "Corners: 1st Half: Total Team 1": "Cantos", "Corners: 1st Half: Total Team 2": "Cantos", "Corners: 2nd Half: Total": "Cantos", "Corners: 2nd Half: Total Team 1": "Cantos", "Corners: 2nd Half: Total Team 2": "Cantos", "Corners: Total (3 way)": "Cantos", "Corners: 1st Half: Handicap": "Cantos", "Corners: 2nd Half: Handicap": "Cantos", "Corners: Result": "Cantos", "Corners: 1st Half: Result": "Cantos", "Corners: 2nd Half: Result": "Cantos", "Corners: Highest Scoring Half": "Cantos", "Corners: 1st Corner": "Cantos", "Corners: Last Corner:": "Cantos", "Corners: 10 Minutes Corners (00:00-9:59)": "Cantos", "Corners: Race to Corners": "Cantos",
         // 12. Cartões Amarelos
         "Yellow Cards: Total Team 1": "Cartões Amarelos", "Yellow Cards: Total Team 2": "Cartões Amarelos", "Yellow Cards: Total Odd/Even": "Cartões Amarelos", "Yellow Cards: 1st Half: Total:": "Cartões Amarelos", "Yellow Cards: 1st Half: Total Team 1": "Cartões Amarelos", "Yellow Cards: 1st Half: Total Team 2": "Cartões Amarelos", "Yellow Cards: 2nd Half: Total": "Cartões Amarelos", "Yellow Cards: 1st Half: Handicap": "Cartões Amarelos", "Yellow Cards: 2nd Half: Handicap": "Cartões Amarelos", "Yellow Cards: Result": "Cartões Amarelos", "Yellow Cards: Double Chance": "Cartões Amarelos", "Yellow Cards: 1st Half: Result": "Cartões Amarelos", "Yellow Cards: 1st Half: Double Chance": "Cartões Amarelos", "Yellow Cards: 2nd Half: Result": "Cartões Amarelos", "Yellow Cards: 2nd Half: Double Chance": "Cartões Amarelos", "Yellow Cards: Highest Scoring Half": "Cartões Amarelos", "Yellow Cards: 1st Yellow Card Minute": "Cartões Amarelos", "Yellow Cards: Both Teams to Receive Cards": "Cartões Amarelos", "Yellow Cards: Both Teams to Receive 2 or More Cards": "Cartões Amarelos",
         // 13. Remates à Baliza
         "Shots on target: Total": "Remates à Baliza", "Shots on target: Total Team 1": "Remates à Baliza", "Shots on target: Total Team 2": "Remates à Baliza", "Shots on target: Total Even/Odd": "Remates à Baliza", "Shots on target: 1st Half: Total:": "Remates à Baliza", "Shots on target: 1st Half: Total Team 1": "Remates à Baliza", "Shots on target: 1st Half: Total Team 2": "Remates à Baliza", "Shots on target: Handicap": "Remates à Baliza", "Shots on target: 1st Half: Handicap": "Remates à Baliza", "Shots on target: Result": "Remates à Baliza", "Shots on target: Double Chance": "Remates à Baliza", "Shots on target: 1st Half: Result": "Remates à Baliza", "Shots on target: 1st Half: Double Chance": "Remates à Baliza", "Shots on target: Highest Scoring Half": "Remates à Baliza",
         // 14. Faltas
         "Fouls: Total": "Faltas", "Fouls: Total Team 1": "Faltas", "Fouls: Total Team 2": "Faltas", "Fouls: Total Even/Odd": "Faltas", "Fouls: Handicap": "Faltas", "Fouls: Result": "Faltas", "Fouls: Double Chance": "Faltas", "Fouls: Highest Scoring Half": "Faltas", "Offsides: Total": "Faltas", "Offsides: Total Team 1": "Faltas", "Offsides: Total Team 2": "Faltas", "Offsides: Total Even/Odd": "Faltas", "Offsides: Handicap": "Faltas", "Offsides: Result": "Faltas", "Offsides: Double Chance": "Faltas",
         // 15. Remates Totais
         "Shots: Total": "Remates Totais", "Shots: Total Team 1": "Remates Totais", "Shots: Total Team 2": "Remates Totais", "Shots: Total Even/Odd": "Remates Totais", "Shots: 1st Half: Total Team 1": "Remates Totais", "Shots: 1st Half: Total Team 2": "Remates Totais", "Shots: Handicap": "Remates Totais", "Shots: 1st Half: Handicap": "Remates Totais", "Shots: Result": "Remates Totais", "Shots: Double Chance": "Remates Totais", "Shots: 1st Half: Result": "Remates Totais", "Shots: 1st Half: Double Chance": "Remates Totais", "Shots: Highest Scoring Half": "Remates Totais",
         // 16. Jogadores
         "Players:": "Jogadores (Totais)",
         "Pattern: Team Scores Only One Half": "Específicos por Equipa"
    };

    const ignorePhrases = new Set([ /* Copied from File 1 (ensure your full list is here) */
        "Live Info", "Live TV", "Bet Slip", "Odds:", "TOTAL WIN", "Log in", "Handicap:Handicap 1 (-1)", "1 000", "LIVE TV IS UNAVAILABLE!",
        "Stake", "Multi System", "Single", "Place bet", "Place", "Log in to watch live matches by using your username and password."
    ]);

    // --- CONSTANTES E REGEX ---
    const teamScoresOneHalfRegex = /^(.+)\s+to score in only one of halves$/i;
    const playersPrefix = "Players:";
    const playersCategory = "Jogadores (Totais)";

    // ========================================================================
    // === HELPER FUNCTIONS ===
    // ========================================================================

    window.getBaseCategory = function(str) {
        if (!str || typeof str !== 'string') return '';
        return str.replace(/\s*\(?\d+(\.\d+)?\)?\s*$/, '').trim();
    };

    function isOddNumber(str) {
         if (!str) return false;
         return /^\s*\d+(\.\d+)?\s*$/.test(str);
     }

     function classifySpecialBlock(header, pairs) {
         const numPairs = pairs.length;
          if (header.includes("Corners: Total") || header.includes("Yellow Cards: Total")) {
              return numPairs === 2 ? 'principal' : 'alternative';
         } else if (header.includes("Handicap") || header.includes("Total")) {
              return numPairs === 2 ? 'principal' : 'alternative';
         }
         return 'principal';
     }

      function createCategoryTable(headerText, originalHeaderText) {
         const table = document.createElement('table');
         table.style.display = 'none'; // Initially hidden
         table.setAttribute('data-original-category', originalHeaderText);
         let mainFilterCategory = 'Categoria Desconhecida';
         if (originalHeaderText.startsWith(playersPrefix)) {
             mainFilterCategory = playersCategory;
         } else if (originalHeaderText === "Pattern: Team Scores Only One Half") {
             mainFilterCategory = categoryMap[originalHeaderText];
         } else {
             mainFilterCategory = categoryMap[originalHeaderText] || 'Categoria Desconhecida';
         }
         table.setAttribute('data-category', mainFilterCategory);
         const thead = document.createElement('thead');
         const headerRow = document.createElement('tr');
         const headerCell = document.createElement('th');
         headerCell.colSpan = 3;
         headerCell.textContent = headerText;
         headerRow.appendChild(headerCell);
         const subHeaderRow = document.createElement('tr');
         const optionTh = document.createElement('th'); optionTh.textContent = 'Opção'; optionTh.style.textAlign = 'left';
         const oddTh = document.createElement('th'); oddTh.textContent = 'Odd'; oddTh.style.textAlign = 'right';
         const scoreTh = document.createElement('th'); scoreTh.textContent = 'Score'; scoreTh.style.textAlign = 'right';
         subHeaderRow.appendChild(optionTh); subHeaderRow.appendChild(oddTh); subHeaderRow.appendChild(scoreTh);
         thead.appendChild(headerRow); thead.appendChild(subHeaderRow);
         table.appendChild(thead);
         const tbody = document.createElement('tbody'); table.appendChild(tbody);
         return table;
     }

     function addTableRow(table, optionText, oddValue) {
         const tbody = table.querySelector('tbody');
         if (!tbody) return;
         const row = document.createElement('tr');
         const textCell = document.createElement('td');
         textCell.textContent = optionText.trim();
         const numberCell = document.createElement('td');
         numberCell.textContent = oddValue.trim();
         numberCell.style.textAlign = 'right';
         const calculationCell = document.createElement('td');
         calculationCell.style.textAlign = 'right';

         const odd = parseFloat(oddValue.trim());
         let score;

           if (!isNaN(odd) && odd > 0) {
                if (odd < 1.11) {
                    score = 0;
                } else if (odd <= 1.25) { // 1.11 a 1.25
                    score = 1;
                } else if (odd <= 1.39) { // 1.26 a 1.39
                    score = 2;
                } else if (odd <= 1.64) { // 1.40 a 1.64
                    score = 3;
                } else if (odd <= 1.92) { // 1.65 a 1.92
                    score = 4;
                } else if (odd <= 2.29) { // 1.93 a 2.29
                    score = 5;
                } else if (odd <= 2.95) { // 2.30 a 2.95
                    score = 6;
                } else if (odd <= 3.98) { // 2.96 a 3.98
                    score = 7;
                } else if (odd <= 6.69) { // 3.99 a 6.69
                    score = 8;
                } else if (odd <= 9.00) { // 6.70 a 9.00
                    score = 9;
                } else { // Acima de 9.00
                    score = 10;
                }
                const boldText = document.createElement('b');
                boldText.textContent = score;
                calculationCell.appendChild(boldText);
         } else {
             calculationCell.textContent = "-";
         }

         row.appendChild(textCell);
         row.appendChild(numberCell);
         row.appendChild(calculationCell);
         tbody.appendChild(row);
     }

    function applyTitleSearchToVisibleTables() {
        const searchInput = document.getElementById("searchSubcategoryInput"); if (!searchInput) return;
        const searchTerm = searchInput.value.toLowerCase().trim();
        const visibleTables = document.querySelectorAll("#settings-popup #outputTables table:not([style*='display: none'])");
        visibleTables.forEach(table => {
            const headerCell = table.querySelector('thead th[colspan="3"]');
            let matchesSearch = true;
            if (headerCell && searchTerm !== '') {
                const headerText = headerCell.textContent.toLowerCase();
                matchesSearch = headerText.includes(searchTerm);
            }
            if (!matchesSearch) {
                table.style.display = 'none';
            }
        });
    }

     window.filterTables = function() {
         var selectedCategoryValue = document.getElementById("categoryFilter").value;
         var tables = document.querySelectorAll("#settings-popup #outputTables table");
         tables.forEach(function(table) {
             const tableFilterCategory = table.getAttribute('data-category');
             if (selectedCategoryValue === 'all' || tableFilterCategory === selectedCategoryValue) {
                 table.style.display = '';
             }
             else {
                 table.style.display = 'none';
             }
         });
         applyTitleSearchToVisibleTables();
     }

    window.convertToTable = function() {
        const convertButton = document.getElementById('create-table-button'); if (convertButton) convertButton.disabled = true;
        var inputText = document.getElementById("inputTextArea").value; var lines = inputText.split('\n');
        var outputDiv = document.getElementById("outputTables"); outputDiv.innerHTML = '';
        const searchInput = document.getElementById("searchSubcategoryInput"); if (searchInput) searchInput.value = '';
        let allParsedBlocks = []; let currentBlockData = null;

        for (const line of lines) {
            let trimmedLine = line.trim();
            if (ignorePhrases.has(trimmedLine) || ["Ù", "Ã", "Á", ""].includes(trimmedLine) || trimmedLine.length === 0) continue;
            let isHeader = false; let potentialHeader = null; let canonicalHeader = null; let mainCategory = null; let isSpecial = false; let isPatternMatch = false;
            const patternMatch = trimmedLine.match(teamScoresOneHalfRegex);
            const baseTrimmedLine = window.getBaseCategory(trimmedLine);
            if (patternMatch) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = "Pattern: Team Scores Only One Half"; isSpecial = false; isPatternMatch = true; }
            else if (trimmedLine.startsWith(playersPrefix)) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = potentialHeader; mainCategory = playersCategory; isSpecial = false; }
            else if (specialCategories.has(trimmedLine)) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = potentialHeader; isSpecial = true; }
            else if (specialCategories.has(baseTrimmedLine)) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = baseTrimmedLine; isSpecial = true; }
            else if (categories.includes(trimmedLine)) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = potentialHeader; isSpecial = false; }
            else if (baseTrimmedLine && categories.includes(baseTrimmedLine)) { isHeader = true; potentialHeader = trimmedLine; canonicalHeader = baseTrimmedLine; isSpecial = false; }

            if (isHeader) {
                if (currentBlockData && currentBlockData.pairs.length > 0) {
                     if (currentBlockData.isSpecial && !currentBlockData.isPatternMatch) currentBlockData.classification = classifySpecialBlock(currentBlockData.header, currentBlockData.pairs);
                     currentBlockData.mainCategory = categoryMap[currentBlockData.canonicalHeader] || "Categoria Desconhecida";
                     if(currentBlockData.header.startsWith(playersPrefix)) currentBlockData.mainCategory = playersCategory;
                     if(currentBlockData.isPatternMatch) currentBlockData.mainCategory = categoryMap[currentBlockData.canonicalHeader];
                     allParsedBlocks.push(currentBlockData);
                }
                currentBlockData = { header: potentialHeader, canonicalHeader: canonicalHeader, pairs: [], mainCategory: mainCategory, isSpecial: isSpecial, isPatternMatch: isPatternMatch, classification: 'standard', pendingOption: null };
            } else if (currentBlockData) {
                if (currentBlockData.pendingOption === null) {
                    if (!isOddNumber(trimmedLine)) {
                       currentBlockData.pendingOption = trimmedLine;
                    }
                }
                else {
                    if (isOddNumber(trimmedLine)) {
                        currentBlockData.pairs.push([currentBlockData.pendingOption, trimmedLine]);
                        currentBlockData.pendingOption = null;
                    }
                    else {
                        currentBlockData.pendingOption += " " + trimmedLine;
                    }
                }
            }
        }
        if (currentBlockData && currentBlockData.pairs.length > 0) {
             if (currentBlockData.isSpecial && !currentBlockData.isPatternMatch) currentBlockData.classification = classifySpecialBlock(currentBlockData.header, currentBlockData.pairs);
             currentBlockData.mainCategory = categoryMap[currentBlockData.canonicalHeader] || "Categoria Desconhecida";
             if(currentBlockData.header.startsWith(playersPrefix)) currentBlockData.mainCategory = playersCategory;
             if(currentBlockData.isPatternMatch) currentBlockData.mainCategory = categoryMap[currentBlockData.canonicalHeader];
             allParsedBlocks.push(currentBlockData);
        }

        let renderedNormalMap = new Map();
        let renderedTeamScoreOneHalfHeaders = new Set();
        for (const block of allParsedBlocks) {
            const { header, canonicalHeader, pairs, mainCategory, isSpecial, isPatternMatch, classification } = block;
             if (!mainCategory || mainCategory === 'Categoria Desconhecida') {
                 continue;
             };
            const baseCanonicalHeader = window.getBaseCategory(canonicalHeader) || canonicalHeader;
            const baseHeader = window.getBaseCategory(header) || header;
            let displayHeader = baseHeader;
            if (header.startsWith(playersPrefix)) { displayHeader = header.substring(playersPrefix.length).trim(); if (!displayHeader) displayHeader = "Jogador - Geral"; }

            let table = null;
            const uniqueBlockIdentifier = isSpecial ? (classification === 'alternative' ? baseCanonicalHeader + ' (Alternativo)' : baseCanonicalHeader) : baseCanonicalHeader;

            if (renderedNormalMap.has(uniqueBlockIdentifier)) {
                table = renderedNormalMap.get(uniqueBlockIdentifier);
                pairs.forEach(pair => addTableRow(table, pair[0], pair[1]));
            } else {
                table = createCategoryTable(displayHeader + (classification === 'alternative' ? ' (Alternativo)' : ''), baseCanonicalHeader);
                pairs.forEach(pair => addTableRow(table, pair[0], pair[1]));
                outputDiv.appendChild(table);
                renderedNormalMap.set(uniqueBlockIdentifier, table);
            }
        }
        window.filterTables();
        const searchInputForTitles = document.getElementById("searchSubcategoryInput");
        if (searchInputForTitles) {
             searchInputForTitles.removeEventListener('input', window.filterTables);
             searchInputForTitles.addEventListener('input', window.filterTables);
        }
        if (convertButton) convertButton.disabled = false;
    }

})();
