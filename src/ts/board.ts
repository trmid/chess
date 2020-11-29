
/// <reference path="./piece.ts" />

interface Board {
    turn: string
    side: string
    piece_set_name: string
    halfturn_num: number
    turn_num: number
    castles: {
        K: boolean
        Q: boolean
        k: boolean
        q: boolean
    }
    board_elem: HTMLTableElement | JQuery<HTMLTableElement>
    tiles: Array<Array<Piece | undefined>>
    pieces: { 'w': Array<Piece>, 'b': Array<Piece> }
    en_passant?: TilePos
}

class Board implements Board {

    /**
     * STATIC VARS
     */

    static START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';



    /**
     * Evaluates if the position is on the board and returns true or false
     */

    static in_bounds(pos: TilePos) {
        return (pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8);
    }



    /**
     * Converts a coordinate position to a standard notation
     */

    static get_tile_code(pos: TilePos) {
        return `${String.fromCharCode(('a').charCodeAt(0) + pos.x)}${pos.y + 1}`;
    }



    /**
     * Converts standard tile location to coordinates
     */

    static get_coord(tile_code: string) {
        return {
            x: tile_code.charCodeAt(0) - ('a').charCodeAt(0),
            y: parseInt(tile_code.charAt(1)) - 1
        };
    }


    /**
     * CONSTRUCTOR
     */

    constructor({
        fen_str = Board.START_FEN,
        side = 'w',
        parent_elem
    }: {
        fen_str: string
        side: string
        parent_elem: HTMLElement | JQuery<HTMLElement>
    }) {

        // Set vars
        this.turn = 'w';
        this.side = side;
        this.piece_set_name = "kiffset_light";

        // Append Board
        $(parent_elem).html("");
        this.append_to(parent_elem);

        // Setup the board
        this.load_fen(fen_str);

    }

    load_fen(fen_str: string) {

        const args = fen_str.split(' ');
        console.log(args);
        const ranks = args[0].split('/');
        this.turn = args[1];
        this.castles = {
            K: args[2].includes('K'),
            Q: args[2].includes('Q'),
            k: args[2].includes('k'),
            q: args[2].includes('q')
        }
        this.en_passant = Board.get_coord(args[3]);
        this.turn_num = parseInt(args[4]);
        this.halfturn_num = parseInt(args[5]);

        // Create the tile arrays
        this.tiles = new Array<Array<Piece | undefined>>(8);
        for (let i = 0; i < 8; i++) {
            this.tiles[i] = new Array<Piece | undefined>(8);
        }


        // Create the piece arrays
        this.pieces = {
            'w': new Array<Piece>(),
            'b': new Array<Piece>()
        };

        // Place the pieces
        for (let rank = 0; rank < ranks.length; rank++) {

            let file = 0;
            let char_num = 0;
            while (file < 8) {
                const char = ranks[7 - rank].charAt(char_num);
                const blank_spaces = parseInt(char);
                if (!isNaN(blank_spaces)) {
                    file += blank_spaces;
                } else {
                    let piece: Piece | undefined = undefined;
                    const type = char.toUpperCase();
                    const side = type === char ? 'w' : 'b';
                    switch (type) {
                        case 'P':
                            piece = new Pawn(file, rank, side, this);
                            break;
                        case 'R':
                            piece = new Rook(file, rank, side, this);
                            break;
                        case 'N':
                            piece = new Knight(file, rank, side, this);
                            break;
                        case 'B':
                            piece = new Bishop(file, rank, side, this);
                            break;
                        case 'Q':
                            piece = new Queen(file, rank, side, this);
                            break;
                        case 'K':
                            piece = new King(file, rank, side, this);
                            break;
                    }
                    if (!piece) {
                        throw new Error(`Piece type [${char}] is not a valid FEN piece code`);
                    }
                    this.tiles[file][rank] = piece;
                    this.pieces[side].push(piece);
                    file++;
                }
                char_num++;
            }

        }

        // Setup visuals
        this.pieces['w'].concat(this.pieces['b']).forEach((piece) => {
            const tile = `${String.fromCharCode(('A').charCodeAt(0) + piece.pos.x)}${piece.pos.y + 1}`;
            $(`td[tile=${tile}]`).append(piece.elem);
        });

    }

    append_to(elem: HTMLElement | JQuery<HTMLElement>) {

        const board = $(document.createElement("table")).addClass("chess-board");
        this.board_elem = board;

        $(elem).append(board);
        for (let row = 1; row <= 8; row++) {
            const tr = $(document.createElement("tr"));
            if (this.side == 'w') {
                board.prepend(tr);
            } else {
                board.append(tr);
            }
            for (let col = 0; col < 8; col++) {
                const char = String.fromCharCode(('A').charCodeAt(0) + col);
                const tile = $(document.createElement("td"))
                    .attr("tile", `${char}${row}`)
                    .attr("x", col)
                    .attr("y", row - 1)
                    .addClass(((row % 2) + col) % 2 == 0 ? "white-tile" : "black-tile")
                    .on("click", (e) => {
                        const piece = this.has_piece_at({ x: col, y: row - 1 }, this.turn);
                        console.log(piece);
                        if (piece) {

                            // Get Moves
                            const moves = piece.get_moves();

                            // Remove all highlights
                            this.remove_all_highlights();

                            // Add new highlights
                            $(e.delegateTarget).addClass('selected');
                            moves.forEach(move => {
                                $(`td[x=${move.x}][y=${move.y}]`)
                                    .addClass(move.tile_class);
                            });

                        } else if ($(e.delegateTarget).hasClass('available_move') || $(e.delegateTarget).hasClass('capture_move')) {

                            const selected = $('.selected');
                            console.log(selected);
                            const selected_pos = {
                                x: parseInt(selected.attr('x') || ""),
                                y: parseInt(selected.attr('y') || "")
                            };
                            const selected_piece = this.piece_at(selected_pos);
                            const moves = selected_piece?.get_moves();
                            console.log(moves);

                            const pos = {
                                x: parseInt($(e.delegateTarget).attr('x') || ""),
                                y: parseInt($(e.delegateTarget).attr('y') || "")
                            };

                            if (moves) {

                                for (let i = 0; i < moves.length; i++) {
                                    const move = moves[i];
                                    if (move.x == pos.x && move.y == pos.y) {

                                        // Remove en passant
                                        this.en_passant = undefined;

                                        // Make the move
                                        move.execute();

                                        // Remove all highlights
                                        this.remove_all_highlights();

                                        // Switch turn and break
                                        this.turn = this.turn == 'w' ? 'b' : 'w';

                                        // Update the URL
                                        const url = new URL(location.href);
                                        url.searchParams.set('fen', this.get_fen_string());
                                        window.history.pushState({}, '', url.toString());

                                        // Break
                                        break;

                                    }
                                }

                            }

                        } else {

                            // Remove all highlights if empty tile selected
                            this.remove_all_highlights();

                        }
                    });
                tr.append(tile);
                // Row Labels
                if (col == 0) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass("row-label")
                            .html("" + row)
                    );
                }
                // Col Labels
                if (row == 1) {
                    tile.append(
                        $(document.createElement("div"))
                            .addClass(`col-label-${this.side}`)
                            .html("" + char)
                    );
                }
            }
        }
        return board;

    }

    has_piece_at(pos: TilePos, color?: string) {
        const piece = this.piece_at(pos);
        if (piece instanceof Piece) {
            if (color) {
                if (piece.color == color) {
                    return piece;
                } else {
                    return undefined;
                }
            } else {
                return piece;
            }
        } else {
            return undefined;
        }
    }

    piece_at(pos: TilePos) {
        return this.tiles[pos.x][pos.y];
    }

    has_enpassant_at(pos: TilePos, color?: string) {
        if (this.en_passant && this.en_passant.x == pos.x && this.en_passant.y == pos.y) {
            const en_passant_piece = this.en_passant.y == 2 ?
                this.piece_at({ x: this.en_passant.x, y: 3 }) :
                this.piece_at({ x: this.en_passant.x, y: 4 });
            if (!en_passant_piece) throw new Error("No Piece at expected en passant position.");
            if (color) {
                if (en_passant_piece.color == color) {
                    return en_passant_piece;
                } else {
                    return undefined;
                }
            } else {
                return en_passant_piece;
            }
        } else {
            return undefined;
        }
    }

    place_piece_at(piece: Piece, pos: TilePos) {
        $(`td[x=${pos.x}][y=${pos.y}]`).append(piece.elem);
    }

    remove_all_highlights() {
        $('.selected').removeClass('selected');
        $('.blocked_move').removeClass('blocked_move');
        $('.available_move').removeClass('available_move');
        $('.capture_move').removeClass('capture_move');
    }

    get_fen_string() {
        let fen = "";

        for (let rank = 7; rank >= 0; rank--) {
            let file = 0;
            let blank = 0;
            while (file < 8) {
                const piece = this.piece_at({ x: file, y: rank });
                if (piece) {
                    if (blank > 0) {
                        fen += blank;
                        blank = 0;
                    }
                    if (piece instanceof Pawn) {
                        fen += piece.color === 'w' ? 'P' : 'p';
                    } else if (piece instanceof Rook) {
                        fen += piece.color === 'w' ? 'R' : 'r';
                    } else if (piece instanceof Knight) {
                        fen += piece.color === 'w' ? 'N' : 'n';
                    } else if (piece instanceof Bishop) {
                        fen += piece.color === 'w' ? 'B' : 'b';
                    } else if (piece instanceof Queen) {
                        fen += piece.color === 'w' ? 'Q' : 'q';
                    } else if (piece instanceof King) {
                        fen += piece.color === 'w' ? 'K' : 'k';
                    }
                } else {
                    blank++;
                }
                file++;
            }
            if (blank > 0) {
                fen += blank;
                blank = 0;
            }
            if (rank > 0) fen += "/";
        }

        // Turn
        fen += ` ${this.turn}`;

        // Castles
        let castles = `${this.castles.K ? 'K' : ''}${this.castles.k ? 'k' : ''}${this.castles.Q ? 'Q' : ''}${this.castles.q ? 'q' : ''}`;
        if (castles.length == 0) {
            castles = '-';
        }
        fen += ` ${castles}`;

        // En Passant
        if (this.en_passant) {
            fen += ` ${Board.get_tile_code(this.en_passant)}`;
        } else {
            fen += ` -`;
        }

        // Turn Number
        fen += ` ${this.turn_num}`;

        // Halfturn Number
        fen += ` ${this.halfturn_num}`;

        return fen;
    }

}