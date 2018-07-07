import * as React from "react";
import {connect} from "react-redux";
import {bindActionCreators, Dispatch} from "redux";
import {createSelector} from "reselect";

import {Classes, Hotkey, Hotkeys, HotkeysTarget, MenuItem} from "@blueprintjs/core";
import {IconName, IconNames} from "@blueprintjs/icons";
import {IItemRendererProps, Suggest} from "@blueprintjs/select";
import * as classNames from "classnames";

import {DataLoadingState, SearchItemType, SearchItemTypes} from "../Constants";
import {getAllSections, getUniqueCCCs} from "../Helpers";
import {IAllReducers, IMetadata} from "../Interfaces";
import {loadMetadata} from "../search/SearchActions";
import {searchItem} from "../sections/SectionActions";

export const searchKeyCombo = "s";

interface ISearchBoxWithPopoverStateProps {
    metadata: IMetadata[];
    searchHistory: IMetadata[];
    status: DataLoadingState;
    uniqueCCCs: string[];
}

interface ISearchBoxWithPopoverDispatchProps {
    onLoadMetadata: () => void;
    onSearchItem: (item: IMetadata) => void;
}

interface IMetadataByType {
    [x: string]: SearchBoxWithPopoverItem[];
}

interface ISearchHeader {
    text: string;
}

type SearchBoxWithPopoverItem = ISearchHeader | IMetadata;

const SuggestWrapper = Suggest.ofType<SearchBoxWithPopoverItem>();

@HotkeysTarget
class SearchBoxWithPopover
    extends React.Component<ISearchBoxWithPopoverStateProps & ISearchBoxWithPopoverDispatchProps> {

    private noResults = (
        // TODO
        // } else if (this.props.searchHistory.length > 0) {
        //     return ([{text: "Recent Searches (No results)"}] as SearchBoxWithPopoverItem[])
        //         .concat(this.props.searchHistory);
        <MenuItem
            disabled={true}
            text={"No results for query"}
        />
    );

    private popoverProps = {
        popoverClassName: "searchPopover",
        portalClassName: "searchPopoverPortal",
    };

    private inputProps = {
        id: "searchInput",
        leftIcon: IconNames.SEARCH as IconName,
    };

    public componentDidMount() {
        this.props.onLoadMetadata();
    }

    public renderHotkeys() {
        return (
            <Hotkeys>
                <Hotkey
                    allowInInput={true}
                    global={true}
                    combo={searchKeyCombo}
                    label="Open Search Box"
                    onKeyDown={this.onOpenSearchBox}
                />
            </Hotkeys>
        );
    }

    public render() {
        return (
            <SuggestWrapper
                closeOnSelect={true}
                inputProps={this.inputProps}
                inputValueRenderer={this.inputValueRenderer}
                itemListPredicate={this.itemListPredicate}
                itemRenderer={this.itemRenderer}
                items={this.props.metadata}
                noResults={this.noResults}
                onItemSelect={this.onItemSelect}
                popoverProps={this.popoverProps}
            />
        );
    }

    private inputValueRenderer = (item: SearchBoxWithPopoverItem) => "";

    private itemListPredicate = (query: string, itemList: SearchBoxWithPopoverItem[]): SearchBoxWithPopoverItem[] => {
        // get metadata that matches query
        const filteredList = itemList.filter((x) => isMetadata(x) && x.token.includes(query.toLowerCase()));

        const metadataByType: IMetadataByType = {
            [SearchItemType.CCC.toString()]: [],
            [SearchItemType.Course.toString()]: [],
            [SearchItemType.Credit.toString()]: [],
            [SearchItemType.Department.toString()]: [],
        };

        const filteredListByType = filteredList
            // separate by SearchItemType
            .reduce((searchOmniboxItemsByType, nextSearchOmniboxItem) => isMetadata(nextSearchOmniboxItem) ? ({
                ...searchOmniboxItemsByType,
                [nextSearchOmniboxItem.itemType.toString()]:
                    searchOmniboxItemsByType[nextSearchOmniboxItem.itemType.toString()].concat(nextSearchOmniboxItem),
            }) : searchOmniboxItemsByType, metadataByType);

        filteredListByType.Course.sort(courseSort(query));

        const filteredListWithHeadersByType: SearchBoxWithPopoverItem[] = SearchItemTypes
            // prevent adding headers if there are no results for the itemType
            .filter((itemType) => filteredListByType[itemType].length !== 0)
            // add header for each itemType
            .map((itemType) => [{text: itemType}, ...filteredListByType[itemType]])
            // convert to a 1D array of metadata and headers
            .reduce((searchOmniboxItems, nextSearchOmniboxItems) =>
                [...searchOmniboxItems, ...nextSearchOmniboxItems], []);

        return filteredListWithHeadersByType.slice(0, 50);
    }

    private itemRenderer(item: SearchBoxWithPopoverItem, {handleClick, modifiers}: IItemRendererProps) {
        const classes = classNames("searchItem", {
            [Classes.ACTIVE]: modifiers.active,
            [Classes.INTENT_PRIMARY]: modifiers.active,
        });

        if (isMetadata(item)) {
            return (
                <MenuItem
                    className={classes}
                    key={`${item.itemType}${item.token}`}
                    text={item.userFriendlyFormat}
                    label={item.info}
                    onClick={handleClick}
                />);
        } else if (isSearchHeader(item)) {
             return (
                <MenuItem
                    disabled={true}
                    className={classes}
                    key={item.text}
                    text={item.text}
                    onClick={handleClick}
                />);
        } else {
            return <div>TODO</div>;
        }
    }

    private onItemSelect = (item: SearchBoxWithPopoverItem | undefined) => {
        if (item !== undefined && isMetadata(item)) {
            this.props.onSearchItem(item);
        }
    }

    private onOpenSearchBox = (event: KeyboardEvent) => {
        const searchInputElement = document.getElementById(this.inputProps.id);
        const popoverElements = document.getElementsByClassName(this.popoverProps.popoverClassName);
        const filterCCCPopoverElement = document.getElementById("filterCCCPopover");

        // intercept the event and focus on the search box if it is not open and the ccc filter box is not open
        if (filterCCCPopoverElement === null && searchInputElement !== null && popoverElements.length === 0) {
            event.preventDefault();
            searchInputElement.focus();
        }
    }
}

const isMetadata = (searchBoxItem: SearchBoxWithPopoverItem): searchBoxItem is IMetadata => {
    return (searchBoxItem as IMetadata).token !== undefined;
};

const isSearchHeader = (searchBoxItem: SearchBoxWithPopoverItem): searchBoxItem is ISearchHeader => {
    return (searchBoxItem as ISearchHeader).text !== undefined;
};

const courseSort = (query: string) => (a: SearchBoxWithPopoverItem, b: SearchBoxWithPopoverItem) => {
    // ignore headers, they should never be passed to this function
    if (!isMetadata(a) || !isMetadata(b)) {
        throw Error("Headers should not be passed to courseSort");
    }

    // get input text
    const InputString = query;
    const inputLen = InputString.length;

    // get shortened courseNum, look at first len(InputString) letters
    const shortA = a.abbreviation.substring(0, inputLen).toLowerCase();
    const shortB = b.abbreviation.substring(0, inputLen).toLowerCase();

    if (InputString === shortA && InputString === shortB) {
        // case 1: a and b are in same dept:
        // compare the letter ordering (eg MATH 120 vs MATH 200)
        return a.abbreviation.localeCompare(b.abbreviation);
    } else if (InputString === shortA && InputString !== shortB) {
        // case 2: a is in dept, b isn't:
        return -1;
    } else if (InputString !== shortA && InputString === shortB) {
        // case 3: a isn't in dept, b is:
        return 1;
    } else {
        // case 4: neither are in depts
        // compare the letter ordering (eg CSCI 200 vs ENGR 340)
        return a.abbreviation.localeCompare(b.abbreviation);
    }
};

export const getMetadata = (state: IAllReducers): IMetadata[] => state.search.metadata;

export const getMetadataUsingAllSections = createSelector(
    [getMetadata, getAllSections, getUniqueCCCs],
    (metadata, allSections, uniqueCCCs) => {
        const coursesNotInMetadata: IMetadata[] = [...new Set(allSections
            .filter((section) => section.main)
            .map((section) => section.departmentAndCourse))]
            .filter((courseAbbreviation) =>
                metadata.find((metadataItem) => metadataItem.abbreviation === courseAbbreviation) === undefined)
            .map((courseAbbreviation) => ({
                abbreviation: courseAbbreviation,
                info: "",
                itemType: SearchItemType.Course,
                name: "",
                token: courseAbbreviation.toLowerCase(),
                userFriendlyFormat: courseAbbreviation,
            }));

        const departmentsNotInMetadata: IMetadata[] = [...new Set(allSections
            .map((section) => section.department))]
            .filter((departmentAbbreviation) =>
                metadata.find((metadataItem) => metadataItem.abbreviation === departmentAbbreviation) === undefined)
            .map((departmentAbbreviation) => ({
                abbreviation: departmentAbbreviation,
                info: "",
                itemType: SearchItemType.Department,
                name: "",
                token: departmentAbbreviation.toLowerCase(),
                userFriendlyFormat: departmentAbbreviation,
            }));

        const cccNotInMetadata: IMetadata[] = uniqueCCCs
            .filter((cccAbbreviation) =>
                metadata.find((metadataItem) => metadataItem.abbreviation === cccAbbreviation) === undefined)
            .map((cccAbbreviation) => ({
                abbreviation: cccAbbreviation,
                info: "",
                itemType: SearchItemType.CCC,
                name: "",
                token: cccAbbreviation.toLowerCase(),
                userFriendlyFormat: cccAbbreviation,
            }));

        return [...metadata, ...coursesNotInMetadata, ...departmentsNotInMetadata, ...cccNotInMetadata];
});

export const SearchBoxWithPopoverConnected = connect(
    (state: IAllReducers): ISearchBoxWithPopoverStateProps => ({
        metadata: getMetadataUsingAllSections(state),
        searchHistory: state.search.searchHistory,
        status: state.search.status,
        uniqueCCCs: getUniqueCCCs(state),
    }),
    (dispatch: Dispatch<IAllReducers>): ISearchBoxWithPopoverDispatchProps => bindActionCreators({
        onLoadMetadata: loadMetadata,
        onSearchItem: (item: IMetadata) => searchItem(item),
    }, dispatch),
)(SearchBoxWithPopover);
